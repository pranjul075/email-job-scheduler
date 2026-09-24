import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export interface EmailJobData {
  scheduledEmailId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
});
