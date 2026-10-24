const { z } = require('zod');
const env = require('../../config/env');
const { APPROVED_TOPICS } = require('../topics');

class NlpClientError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class NlpUnavailableError extends NlpClientError {
  constructor(message = 'NLP service is unavailable', details = {}) {
    super('NLP_SERVICE_UNAVAILABLE', message, details);
  }
}

class NlpTimeoutError extends NlpClientError {
  constructor(message = 'NLP service request timed out', details = {}) {
    super('NLP_TIMEOUT', message, details);
  }
}

class NlpResponseInvalidError extends NlpClientError {
  constructor(message = 'NLP response failed schema validation', details = {}) {
    super('NLP_RESPONSE_INVALID', message, details);
  }
}

class NlpInferenceError extends NlpClientError {
  constructor(message = 'NLP inference execution failed', details = {}) {
    super('NLP_INFERENCE_FAILED', message, details);
  }
}

const nlpResponseSchema = z.object({
  sentiment: z.object({
    label: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number()).optional(),
  }),
  topics: z.array(
    z.object({
      label: z.enum(APPROVED_TOPICS),
      confidence: z.number().min(0).max(1),
    })
  ),
  modelVersion: z.string(),
});

/**
 * Dedicated HTTP client for communicating with the Python NLP Microservice.
 * Enforces bounded timeouts, connection failure handling, and strict response validation.
 * @param {string} text - Student feedback comment text
 * @param {object} [options]
 * @param {string} [options.url] - Overridden service URL
 * @param {number} [options.timeoutMs] - Overridden timeout in milliseconds
 * @returns {Promise<z.infer<typeof nlpResponseSchema>>}
 */
async function analyzeFeedback(text, options = {}) {
  const baseUrl = options.url || env.NLP_SERVICE_URL;
  const timeoutMs = options.timeoutMs || env.NLP_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
  };
  if (env.NLP_SERVICE_TOKEN) {
    headers['X-NLP-Token'] = env.NLP_SERVICE_TOKEN;
  }

  try {
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new NlpUnavailableError(
        'NLP service rejected the service token (HTTP 401). Check NLP_SERVICE_TOKEN matches on both services.'
      );
    }

    if (response.status === 503) {
      throw new NlpUnavailableError('NLP inference service is temporarily unavailable (HTTP 503).');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error body');
      throw new NlpInferenceError(
        `NLP service returned HTTP ${response.status}`,
        { status: response.status, body: errorBody }
      );
    }

    const json = await response.json();
    const parseResult = nlpResponseSchema.safeParse(json);

    if (!parseResult.success) {
      throw new NlpResponseInvalidError(
        'NLP response payload failed strict contract validation',
        { validationErrors: parseResult.error.format() }
      );
    }

    return parseResult.data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new NlpTimeoutError(
        `NLP request timed out after ${timeoutMs}ms`,
        { timeoutMs }
      );
    }
    if (err instanceof NlpClientError) {
      throw err;
    }
    throw new NlpUnavailableError(
      `Failed to connect to NLP service: ${err.message}`,
      { originalError: err.message }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  analyzeFeedback,
  nlpResponseSchema,
  approvedTopics: APPROVED_TOPICS,
  NlpClientError,
  NlpUnavailableError,
  NlpTimeoutError,
  NlpResponseInvalidError,
  NlpInferenceError,
};
