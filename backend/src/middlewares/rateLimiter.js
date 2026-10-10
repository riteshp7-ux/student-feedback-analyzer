const env = require('../config/env');

/**
 * In-memory sliding/fixed window rate limiter.
 * Zero external dependencies; protects against brute force and denial of service.
 * Automatically cleans up stale IP entries to prevent memory leaks.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const maxRequests = options.max || 30; // default 30 requests per window
  const message = options.message || 'Too many requests, please try again later.';
  const code = options.code || 'TOO_MANY_REQUESTS';
  const forceEnable = options.forceEnable || false;

  const store = new Map();

  // Periodic sweeper to evict expired records and prevent unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(ip);
      }
    }
  }, Math.max(windowMs, 60000));

  // Ensure timer does not prevent process termination
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiterMiddleware(req, res, next) {
    // Disable rate limiting in test suite unless explicitly force-enabled
    if (!forceEnable && env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(ip, entry);
    } else {
      entry.count += 1;
    }

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfterSec = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSec);
      const errorPayload = {
        error: {
          code,
          message,
          retryAfterSeconds: retryAfterSec,
        },
      };

      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(429).json(errorPayload);
      }
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(errorPayload));
    }

    return next();
  };
}

// 1. Strict Limiter for Authentication (Mitigates Credential Stuffing & Brute Force)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes per IP
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

// 2. Submission Limiter for Public Feedback (Prevents Automated Form Spamming)
const feedbackLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 submissions per minute per IP
  message: 'Feedback submission rate limit exceeded. Please wait a minute before submitting again.',
  code: 'FEEDBACK_RATE_LIMIT_EXCEEDED',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  feedbackLimiter,
};
