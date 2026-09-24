import redisConnection from '../config/redis.js';
import { env } from '../config/env.js';

const ATOMIC_HOURLY_INCR_LUA = `
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return -1
else
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], 7200)
  end
  return count
end
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'HOURLY_LIMIT_REACHED' | 'MIN_DELAY_NOT_MET';
  retryAfterMs?: number;
  nextWindowDate?: Date;
  currentCount?: number;
}

export const getHourWindowTimestamp = (date: Date = new Date()): number => {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours()
  )).getTime();
};

export const checkAndConsumeRateLimits = async (
  senderId: string,
  hourlyLimitOverride?: number,
  minDelaySecondsOverride?: number
): Promise<RateLimitCheckResult> => {
  const minDelaySec = minDelaySecondsOverride ?? env.MIN_EMAIL_DELAY_SECONDS;
  const minDelayMs = minDelaySec * 1000;
  const hourlyLimit = hourlyLimitOverride ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  const lastSentKey = `email_last_sent:${senderId}`;
  const lastSentVal = await redisConnection.get(lastSentKey);
  const now = Date.now();

  if (lastSentVal) {
    const elapsed = now - parseInt(lastSentVal, 10);
    if (elapsed < minDelayMs) {
      return {
        allowed: false,
        reason: 'MIN_DELAY_NOT_MET',
        retryAfterMs: minDelayMs - elapsed + 50,
      };
    }
  }

  const currentHourTs = getHourWindowTimestamp(new Date(now));
  const rateKey = `email_rate:${senderId}:${currentHourTs}`;

  const countResult = (await redisConnection.eval(
    ATOMIC_HOURLY_INCR_LUA,
    1,
    rateKey,
    hourlyLimit.toString()
  )) as number;

  if (countResult === -1) {
    const nextHourWindowTs = currentHourTs + 3600000;
    const retryAfterMs = Math.max(1000, nextHourWindowTs - now + 500);
    return {
      allowed: false,
      reason: 'HOURLY_LIMIT_REACHED',
      retryAfterMs,
      nextWindowDate: new Date(nextHourWindowTs),
    };
  }

  await redisConnection.set(lastSentKey, now.toString(), 'EX', 7200);

  return {
    allowed: true,
    currentCount: countResult,
  };
};

export const acquireEmailLock = async (emailId: string, ttlSeconds = 60): Promise<boolean> => {
  const result = await redisConnection.set(`email_lock:${emailId}`, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
};

export const releaseEmailLock = async (emailId: string): Promise<void> => {
  await redisConnection.del(`email_lock:${emailId}`);
};
