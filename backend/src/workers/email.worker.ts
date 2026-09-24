import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queues/email.queue.js';
import { redisConnection, createRedisClient } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import {
  checkAndConsumeRateLimits,
  acquireEmailLock,
  releaseEmailLock,
} from '../services/rate-limiter.service.js';
import { sendEmailViaSmtp } from '../services/ethereal.service.js';
import { dispatchRateLimitSlackAlert } from '../services/slack.service.js';
import { searchService } from '../services/elasticsearch.service.js';

export const processEmailJob = async (job: Job<EmailJobData>): Promise<void> => {
  const { scheduledEmailId } = job.data;

  console.log('WORKER_JOB_RECEIVED', {
    jobId: job.id,
    scheduledEmailId,
  });

  const email = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: {
      senderRef: true,
      campaignRef: true,
      userRef: true,
    },
  });

  if (!email) {
    return;
  }

  if (email.status === 'SENT' || email.status === 'FAILED') {
    return;
  }

  const lockAcquired = await acquireEmailLock(email.id);
  if (!lockAcquired) {
    return;
  }

  const claimCount = await prisma.scheduledEmail.updateMany({
    where: {
      id: email.id,
      status: { in: ['PENDING', 'RATE_LIMITED'] },
    },
    data: {
      status: 'PROCESSING',
    },
  });

  if (claimCount.count === 0) {
    await releaseEmailLock(email.id);
    return;
  }

  try {
    const rateLimit = await checkAndConsumeRateLimits(
      email.senderId,
      email.campaignRef.hourlyLimit,
      email.campaignRef.delaySeconds
    );

    if (!rateLimit.allowed) {
      if (rateLimit.reason === 'MIN_DELAY_NOT_MET') {
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: { status: 'PENDING' },
        });

        await releaseEmailLock(email.id);

        const delay = Math.max(500, rateLimit.retryAfterMs || 1000);
        const newJobId = `delay_${email.id}_${Date.now()}`;
        console.log('JOB_RESCHEDULED', {
          emailId: email.id,
          reason: 'MIN_DELAY_NOT_MET',
          delayMs: delay,
        });
        console.log('QUEUE_JOB_CREATED', {
          jobId: newJobId,
          scheduledEmailId: email.id,
          delay,
        });

        await emailQueue.add(
          'send-email',
          { scheduledEmailId: email.id },
          {
            delay,
            jobId: newJobId,
          }
        );
        return;
      }

      if (rateLimit.reason === 'HOURLY_LIMIT_REACHED') {
        const nextDate = rateLimit.nextWindowDate || new Date(Date.now() + 3600000);

        console.log('JOB_RATE_LIMITED', {
          emailId: email.id,
          sender: email.senderRef.email,
          hourlyLimit: email.campaignRef.hourlyLimit,
          nextWindowDate: nextDate.toISOString(),
        });

        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: {
            status: 'RATE_LIMITED',
            scheduledAt: nextDate,
          },
        });

        await releaseEmailLock(email.id);

        const affectedCount = await prisma.scheduledEmail.count({
          where: {
            campaignId: email.campaignId,
            status: { in: ['RATE_LIMITED', 'PENDING'] },
          },
        });

        try {
          await dispatchRateLimitSlackAlert({
            userId: email.userId,
            senderEmail: email.senderRef.email,
            senderName: email.senderRef.name,
            hourlyLimit: email.campaignRef.hourlyLimit,
            nextWindowDate: nextDate,
            affectedCount,
          });
        } catch (slackError: any) {
          console.log('SLACK_MESSAGE_FAILED', {
            error: slackError?.message || 'Worker Slack alert dispatch failed',
          });
        }

        await searchService.updateEmailStatus(email.id, 'RATE_LIMITED');

        const delay = Math.max(1000, rateLimit.retryAfterMs || 3600000);
        const newJobId = `window_${email.id}_${nextDate.getTime()}`;
        console.log('JOB_RESCHEDULED', {
          emailId: email.id,
          reason: 'HOURLY_LIMIT_REACHED',
          delayMs: delay,
        });
        console.log('QUEUE_JOB_CREATED', {
          jobId: newJobId,
          scheduledEmailId: email.id,
          delay,
        });

        await emailQueue.add(
          'send-email',
          { scheduledEmailId: email.id },
          {
            delay,
            jobId: newJobId,
          }
        );
        return;
      }
    }

    console.log('EMAIL_SEND_STARTED', {
      emailId: email.id,
      recipient: email.recipientEmail,
    });

    const sendResult = await sendEmailViaSmtp({
      fromName: email.senderRef.name,
      fromEmail: email.senderRef.email,
      toEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      senderHost: email.senderRef.host,
      senderPort: email.senderRef.port,
      senderUser: email.senderRef.user,
      senderPass: email.senderRef.pass,
    });

    console.log('EMAIL_SEND_SUCCESS', {
      emailId: email.id,
      recipient: email.recipientEmail,
      messageId: sendResult.messageId,
    });

    const now = new Date();

    await prisma.$transaction([
      prisma.scheduledEmail.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: now,
          etherealMessageId: sendResult.messageId,
          etherealPreviewUrl: sendResult.previewUrl,
          error: null,
        },
      }),
      prisma.campaign.update({
        where: { id: email.campaignId },
        data: {
          sentCount: { increment: 1 },
        },
      }),
    ]);

    await releaseEmailLock(email.id);

    await searchService.updateEmailStatus(email.id, 'SENT', now, null);

    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: email.campaignId },
    });

    if (
      updatedCampaign &&
      updatedCampaign.sentCount + updatedCampaign.failedCount >= updatedCampaign.totalRecipients
    ) {
      await prisma.campaign.update({
        where: { id: email.campaignId },
        data: {
          status:
            updatedCampaign.failedCount > 0 ? 'PARTIALLY_FAILED' : 'COMPLETED',
        },
      });
    }
  } catch (err: any) {
    await releaseEmailLock(email.id);

    const errorMessage = err?.message || 'Unknown SMTP dispatch failure';
    console.log('EMAIL_SEND_FAILED', {
      emailId: email.id,
      recipient: email.recipientEmail,
      error: errorMessage,
    });

    await prisma.$transaction([
      prisma.scheduledEmail.update({
        where: { id: email.id },
        data: {
          status: 'FAILED',
          error: errorMessage,
        },
      }),
      prisma.campaign.update({
        where: { id: email.campaignId },
        data: {
          failedCount: { increment: 1 },
        },
      }),
    ]);

    await searchService.updateEmailStatus(email.id, 'FAILED', null, errorMessage);

    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: email.campaignId },
    });

    if (
      updatedCampaign &&
      updatedCampaign.sentCount + updatedCampaign.failedCount >= updatedCampaign.totalRecipients
    ) {
      await prisma.campaign.update({
        where: { id: email.campaignId },
        data: {
          status: 'PARTIALLY_FAILED',
        },
      });
    }

    throw err;
  }
};

export const createEmailWorker = () => {
  const workerRedis = createRedisClient();

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      connection: workerRedis,
      concurrency: env.WORKER_CONCURRENCY,
      lockDuration: 30000,
    }
  );

  worker.on('completed', (job: Job) => {
    console.log('JOB_COMPLETED', { jobId: job.id });
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.log('JOB_FAILED', { jobId: job?.id, error: err.message });
  });

  worker.on('error', (err: Error) => {
    console.error('WORKER_ERROR', { error: err.message });
  });

  return worker;
};
