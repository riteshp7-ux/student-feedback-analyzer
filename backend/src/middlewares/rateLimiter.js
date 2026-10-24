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

  // Custom bucket-key strategy. Defaults to per-IP, but login routes pass an
  // ip+email key so a shared campus NAT or a reverse proxy (where every client
  // shares one observed IP) cannot lock out unrelated users.
  const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || '127.0.0.1');

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

    const bucketKey = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(bucketKey);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(bucketKey, entry);
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

// 1a. Account-scoped login limiter (primary brute-force defense).
// Keyed on client IP + target email: caps attempts per account regardless of
// which shared egress IP the traffic arrives from, without letting one account's
// attackers lock out every other user behind the same NAT.
const loginIdentityKey = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const rawIdentifier = typeof req.body?.email === 'string'
    ? req.body.email
    : (typeof req.body?.loginId === 'string' ? req.body.loginId : '(unknown)');
  const identifier = rawIdentifier.trim().toLowerCase();
  return `${ip}|${identifier}`;
};

const authIdentityLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes per IP+account
  keyGenerator: loginIdentityKey,
  message: 'Too many login attempts for this account. Please wait 15 minutes before trying again.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

// 1b. Coarse per-IP flood guard. Deliberately generous: campus NATs and
// reverse proxies collapse many legitimate users onto one observed IP, so the
// tight cap lives in the identity limiter above. Note: with TRUST_PROXY_HOPS
// unset on a proxied deployment this bucket is shared deployment-wide.
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 attempts per 15 minutes per observed IP
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
  authIdentityLimiter,
  authLimiter,
  feedbackLimiter,
};
