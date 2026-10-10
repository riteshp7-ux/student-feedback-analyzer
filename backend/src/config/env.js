const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/feedback_analyzer'),
  JWT_SECRET: z.string().min(16).default('development_jwt_secret_must_be_long_enough_123'),
  NLP_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
  NLP_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET === 'development_jwt_secret_must_be_long_enough_123' ||
      process.env.JWT_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'Production requires an explicit, secure JWT_SECRET of at least 32 characters. Development fallback is prohibited.',
      });
    }
    if (
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes('postgres:postgres@localhost')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production requires an explicit, production-grade DATABASE_URL. Default local credentials are prohibited.',
      });
    }
    if (
      !process.env.FRONTEND_URL ||
      process.env.FRONTEND_URL.includes('localhost')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_URL'],
        message: 'Production requires an explicit FRONTEND_URL matching the production web domain. Localhost is prohibited in production.',
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[CONFIG ERROR] Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

module.exports = parsed.data;

