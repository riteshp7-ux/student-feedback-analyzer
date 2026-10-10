const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { checkDatabaseHealth } = require('./config/db');
const { securityHeadersMiddleware } = require('./middlewares/securityHeaders');

const app = express();

// Disable X-Powered-By fingerprint
app.disable('x-powered-by');

// Enforce standard defensive HTTP headers
app.use(securityHeadersMiddleware);

// Strict CORS Policy: Restrict to configured frontend origins
const allowedOrigins = [env.FRONTEND_URL];
if (env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser callers (curl, server-to-server, node tests)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400,
}));

// Request Body Size Limit (prevents memory exhaustion)
app.use(express.json({ limit: '100kb' }));

// Liveness Probe (process is alive, does not execute external queries)
app.get('/health/live', (req, res) => {
  return res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness Probe (checks if database pool is ready for queries)
app.get('/health/ready', async (req, res) => {
  const isDbConnected = await checkDatabaseHealth();
  const statusCode = isDbConnected ? 200 : 503;
  return res.status(statusCode).json({
    status: isDbConnected ? 'ready' : 'unavailable',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'online',
      database: isDbConnected ? 'connected' : 'disconnected',
    },
  });
});

// General System Health Check (backwards-compatible with /health)
app.get('/health', async (req, res) => {
  const isDbConnected = await checkDatabaseHealth();
  const status = isDbConnected ? 'healthy' : 'degraded';
  const statusCode = isDbConnected ? 200 : 503;

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      backend: 'online',
      database: isDbConnected ? 'connected' : 'disconnected',
    },
  });
});

// API v1 Mount Point Root Health Check
app.get('/api/v1/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    version: 'v1',
    message: 'Student Feedback Analyzer API Gateway is operational.',
  });
});

// API v1 Business Routes
app.use('/api/v1', require('./modules/auth/authRoutes'));
app.use('/api/v1', require('./modules/courses/courseRoutes'));
app.use('/api/v1', require('./modules/feedback/feedbackRoutes'));
app.use('/api/v1', require('./modules/dashboard/dashboardRoutes'));

// 404 Handler for Unknown Routes
app.use((req, res) => {
  return res.status(404).json({
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `The requested path ${req.originalUrl} was not found on this server.`,
    },
  });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  // Body-parser malformed JSON syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body.',
      },
    });
  }

  // Body-parser payload too large (413)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds the maximum permitted size limit of 100kb.',
      },
    });
  }

  // Safe domain-level errors from service layer
  if (err.code && err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || {},
      },
    });
  }

  console.error('[UNHANDLED ERROR]', err);

  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' 
        ? 'An unexpected internal server error occurred.' 
        : err.message || 'An unexpected error occurred.',
    },
  });
});

module.exports = app;
