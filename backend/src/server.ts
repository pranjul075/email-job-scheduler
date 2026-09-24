import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redisConnection } from './config/redis.js';
import { searchService } from './services/elasticsearch.service.js';
import { createEmailWorker } from './workers/email.worker.js';

const startServer = async () => {
  await searchService.checkHealthAndInitialize();

  const app = createApp();
  const server = http.createServer(app);

  /**
   * Start the BullMQ email worker in-process so that running
   * `npm run dev` (or `npm start`) is sufficient to both serve
   * HTTP requests AND consume email jobs from the queue.
   *
   * The standalone worker-runner.ts is kept for production
   * deployments that prefer separate server / worker processes.
   */
  const worker = createEmailWorker();
  process.stdout.write(
    `Email queue worker started (concurrency=${env.WORKER_CONCURRENCY})\n`
  );

  server.listen(env.PORT, () => {
    process.stdout.write(`Server listening on port ${env.PORT}\n`);
  });

  const handleShutdown = async (signal: string) => {
    process.stdout.write(`Received ${signal}, initiating graceful shutdown\n`);

    server.close(async () => {
      try {
        await worker.close();
        await prisma.$disconnect();
        await redisConnection.quit();
        process.exit(0);
      } catch (err) {
        process.exit(1);
      }
    });

    setTimeout(() => {
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer();
