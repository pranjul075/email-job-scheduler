import { emailQueue } from '../queues/email.queue.js';
import { redisConnection } from '../config/redis.js';

(async () => {
  try {
    await emailQueue.obliterate({ force: true });
    await emailQueue.resume();
    console.log('Email dispatch queue cleaned successfully.');
    await redisConnection.quit();
    process.exit(0);
  } catch (err) {
    console.error('Queue cleanup failed:', err);
    await redisConnection.quit();
    process.exit(1);
  }
})();

