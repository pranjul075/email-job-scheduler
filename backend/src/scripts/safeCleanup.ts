import { emailQueue, EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { prisma } from '../config/prisma.js';
import { redisConnection } from '../config/redis.js';

export interface CleanupPreview {
  queueName: string;
  jobCounts: {
    waiting: number;
    delayed: number;
    active: number;
    failed: number;
    completed: number;
  };
  redisKeysToDelete: string[];
  campaignsToDelete: Array<{
    id: string;
    name: string;
    status: string;
    totalRecipients: number;
    createdAt: Date;
  }>;
  scheduledEmailsToDeleteCount: number;
  usersPreservedCount: number;
  sendersPreservedCount: number;
  slackConnectionsPreservedCount: number;
}

export const previewCleanup = async (): Promise<CleanupPreview> => {
  const counts = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'failed', 'completed');

  const rateKeys = await redisConnection.keys('email_rate:*');
  const lastSentKeys = await redisConnection.keys('email_last_sent:*');
  const lockKeys = await redisConnection.keys('email_lock:*');
  const slackKeys = await redisConnection.keys('slack_alert_sent:*');
  const redisKeysToDelete = [...rateKeys, ...lastSentKeys, ...lockKeys, ...slackKeys];

  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      totalRecipients: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const scheduledEmailsCount = await prisma.scheduledEmail.count();
  const usersCount = await prisma.user.count();
  const sendersCount = await prisma.sender.count();
  const slackCount = await prisma.slackConnection.count();

  return {
    queueName: EMAIL_QUEUE_NAME,
    jobCounts: {
      waiting: counts.waiting || 0,
      delayed: counts.delayed || 0,
      active: counts.active || 0,
      failed: counts.failed || 0,
      completed: counts.completed || 0,
    },
    redisKeysToDelete,
    campaignsToDelete: campaigns,
    scheduledEmailsToDeleteCount: scheduledEmailsCount,
    usersPreservedCount: usersCount,
    sendersPreservedCount: sendersCount,
    slackConnectionsPreservedCount: slackCount,
  };
};

export const executeCleanup = async () => {
  const preview = await previewCleanup();

  // 1. Drain BullMQ Queue
  await emailQueue.drain(true);
  await emailQueue.clean(0, 10000, 'delayed');
  await emailQueue.clean(0, 10000, 'wait');
  await emailQueue.clean(0, 10000, 'active');
  await emailQueue.clean(0, 10000, 'completed');
  await emailQueue.clean(0, 10000, 'failed');

  // 2. Delete rate limiter and lock keys in Redis
  if (preview.redisKeysToDelete.length > 0) {
    await redisConnection.del(...preview.redisKeysToDelete);
  }

  // 3. Delete scheduled emails and test campaigns
  await prisma.scheduledEmail.deleteMany();
  await prisma.campaign.deleteMany();

  return preview;
};

if (process.argv[1]?.endsWith('safeCleanup.ts')) {
  const isExecute = process.argv.includes('--execute');

  (async () => {
    try {
      if (isExecute) {
        console.log('Executing safe cleanup...');
        const result = await executeCleanup();
        console.log('Safe cleanup complete:', JSON.stringify(result, null, 2));
      } else {
        console.log('Previewing safe cleanup (dry-run):');
        const preview = await previewCleanup();
        console.log(JSON.stringify(preview, null, 2));
      }
    } catch (err) {
      console.error('Safe cleanup error:', err);
    } finally {
      await redisConnection.quit();
      await prisma.$disconnect();
      process.exit(0);
    }
  })();
}
