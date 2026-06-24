import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redisConnectionOptions: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

export const NOTIFICATION_QUEUE_NAME = 'notifications';

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: redisConnectionOptions,
});
