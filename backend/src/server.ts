import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redisConnection } from './config/redis.js';
import { searchService } from './services/elasticsearch.service.js';

const startServer = async () => {
  await searchService.checkHealthAndInitialize();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    process.stdout.write(`Server listening on port ${env.PORT}\n`);
  });

  const handleShutdown = async (signal: string) => {
    process.stdout.write(`Received ${signal}, initiating graceful shutdown\n`);

    server.close(async () => {
      try {
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
