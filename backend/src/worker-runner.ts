import { createEmailWorker } from './workers/email.worker.js';
import { prisma } from './config/prisma.js';
import { redisConnection } from './config/redis.js';
import { env } from './config/env.js';

const startWorker = async () => {
  process.stdout.write(
    `Starting Email Queue Worker with concurrency=${env.WORKER_CONCURRENCY}\n`
  );

  const worker = createEmailWorker();

  const handleShutdown = async (signal: string) => {
    process.stdout.write(`Received ${signal}, closing worker gracefully\n`);

    try {
      await worker.close();
      await prisma.$disconnect();
      await redisConnection.quit();
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startWorker();
