import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redisEnabled = !!REDIS_HOST;

export const redisConnectionOptions: RedisOptions = {
  host: REDIS_HOST || 'localhost',
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const NOTIFICATION_QUEUE_NAME = 'notifications';

// Only create queue if Redis is configured
export const notificationQueue = redisEnabled
  ? new Queue(NOTIFICATION_QUEUE_NAME, { connection: redisConnectionOptions })
  : null;
