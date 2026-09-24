import IORedis from 'ioredis';
import { env } from './env.js';

/**
 * Single Redis client used across the application.
 * Exposes the complete ioredis API (set, get, eval, del, quit, …).
 */
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * Alias kept for legacy imports.
 */
export const redis = redisConnection;

/**
 * Helper to create a fresh client (used by workers that need
 * a separate connection for pub/sub or isolation).
 */
export const createRedisClient = (): IORedis => {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
};

/**
 * Default export for convenience.
 */
export default redisConnection;

