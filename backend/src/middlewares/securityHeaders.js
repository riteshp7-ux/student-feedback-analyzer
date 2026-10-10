const env = require('../config/env');

/**
 * Standard HTTP Security Headers middleware.
 * Enforces defensive posture across API responses without heavy third-party dependencies.
 */
function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking & framing
  res.setHeader('X-Frame-Options', 'DENY');

  // Modern browser XSS filtering control
  res.setHeader('X-XSS-Protection', '0');

  // Control referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict API response rendering contexts
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  // Prevent window.opener tracking across origins
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Enforce HSTS in production environments
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

module.exports = {
  securityHeadersMiddleware,
};
