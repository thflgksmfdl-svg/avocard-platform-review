import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from './env.js';

/**
 * Paths pino must always redact, regardless of caller. Anything that could
 * carry a credential, secret, or full request body from an external
 * provider must be masked before it is ever written to a log line.
 */
export const SECRET_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers.cookie',
  '*.apiKey',
  '*.api_key',
  '*.appKey',
  '*.appSecret',
  '*.secret',
  '*.password',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.sessionSecret',
];

export function buildLoggerOptions(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>) {
  return {
    level: config.logLevel,
    redact: {
      paths: SECRET_REDACT_PATHS,
      censor: '[REDACTED]',
    },
    transport:
      config.nodeEnv === 'development'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          }
        : undefined,
  };
}

export type Logger = FastifyBaseLogger;
