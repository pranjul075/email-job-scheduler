import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma.js';
import { emailQueue } from '../queues/email.queue.js';
import { searchService } from './elasticsearch.service.js';

export interface CreateCampaignInput {
  userId: string;
  senderId: string;
  name?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: Date;
  delaySeconds?: number;
  hourlyLimit?: number;
}

export const extractAndValidateEmails = (input: string | string[]): {
  validEmails: string[];
  duplicatesRemoved: number;
  invalidCount: number;
} => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  let rawList: string[] = [];

  if (Array.isArray(input)) {
    rawList = input;
  } else {
    rawList = input
      .split(/[\r\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  }

  const seen = new Set<string>();
  const validEmails: string[] = [];
  let duplicatesRemoved = 0;
  let invalidCount = 0;

  for (const raw of rawList) {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned) continue;

    if (!emailRegex.test(cleaned)) {
      invalidCount++;
      continue;
    }

    if (seen.has(cleaned)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(cleaned);
    validEmails.push(cleaned);
  }

  return {
    validEmails,
    duplicatesRemoved,
    invalidCount,
  };
};

export const scheduleCampaign = async (input: CreateCampaignInput) => {
  const { validEmails } = extractAndValidateEmails(input.recipients);

  if (validEmails.length === 0) {
    throw new Error('No valid recipients provided for scheduling');
  }

  const sender = await prisma.sender.findFirst({
    where: {
      id: input.senderId,
      userId: input.userId,
    },
  });

  if (!sender) {
    throw new Error('Sender not found or does not belong to user');
  }

  const delaySeconds = Math.max(1, input.delaySeconds ?? 2);
  const hourlyLimit = Math.max(1, input.hourlyLimit ?? 200);
  const startAt = input.startTime ? new Date(input.startTime) : new Date();
  const startTimestamp = Math.max(Date.now(), startAt.getTime());

  const campaign = await prisma.campaign.create({
    data: {
      userId: input.userId,
      senderId: input.senderId,
      name: input.name || input.subject.slice(0, 50) || 'Untitled Campaign',
      subject: input.subject,
      body: input.body,
      delaySeconds,
      hourlyLimit,
      scheduledAt: new Date(startTimestamp),
      status: 'SCHEDULED',
      totalRecipients: validEmails.length,
      sentCount: 0,
      failedCount: 0,
    },
  });

  const now = Date.now();
  const scheduledRecords = validEmails.map((recipientEmail, index) => {
    const emailId = randomUUID();
    const emailScheduleTime = new Date(startTimestamp + index * delaySeconds * 1000);
    const idempotencyKey = `email_${campaign.id}_${recipientEmail}_${index}_${emailScheduleTime.getTime()}`;

    return {
      id: emailId,
      campaignId: campaign.id,
      senderId: input.senderId,
      userId: input.userId,
      recipientEmail,
      subject: input.subject,
      body: input.body,
      scheduledAt: emailScheduleTime,
      status: 'PENDING' as const,
      bullJobId: idempotencyKey,
      idempotencyKey,
    };
  });

  const BATCH_SIZE = 500;
  for (let i = 0; i < scheduledRecords.length; i += BATCH_SIZE) {
    const chunk = scheduledRecords.slice(i, i + BATCH_SIZE);
    await prisma.scheduledEmail.createMany({
      data: chunk,
    });
  }

  const bullJobs = scheduledRecords.map((item) => {
    const delay = Math.max(0, item.scheduledAt.getTime() - now);
    return {
      name: 'send-email',
      data: { scheduledEmailId: item.id },
      opts: {
        delay,
        jobId: item.idempotencyKey,
      },
    };
  });

  for (let i = 0; i < bullJobs.length; i += BATCH_SIZE) {
    const chunk = bullJobs.slice(i, i + BATCH_SIZE);
    await emailQueue.addBulk(chunk);
    for (const job of chunk) {
      console.log('QUEUE_JOB_CREATED', {
        jobId: job.opts.jobId,
        scheduledEmailId: job.data.scheduledEmailId,
        delay: job.opts.delay,
      });
    }
  }

  for (const item of scheduledRecords) {
    searchService.indexEmail({
      id: item.id,
      recipientEmail: item.recipientEmail,
      senderEmail: sender.email,
      senderName: sender.name,
      subject: item.subject,
      body: item.body,
      status: 'PENDING',
      scheduledAt: item.scheduledAt.toISOString(),
      userId: input.userId,
      campaignId: campaign.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    campaign,
    scheduledCount: scheduledRecords.length,
  };
};
