import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints.
 * Limits each IP to 100 requests per 15-minute window in development,
 * 10 in production.
 */
const isDev = process.env.NODE_ENV !== 'production';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
