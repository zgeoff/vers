import { expect, test } from 'bun:test';
import * as z from 'zod';
import { buildEnvContract } from './build-env-contract';

test('it sorts required keys as those whose schema rejects an absent value', () => {
  const contract = buildEnvContract({
    DATABASE_URL: z.string(),
    FEATURE_FLAG: z.string().optional(),
    RETRY_LIMIT: z.coerce.number().default(3),
  });

  expect(contract).toStrictEqual({
    optional: [
      'FEATURE_FLAG',
      'LOG_LEVEL',
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'PORT',
      'RETRY_LIMIT',
      'SENTRY_DSN',
    ],
    required: ['DATABASE_URL', 'SERVICE_AUTH_PUBLIC_KEY'],
  });
});

test('it lets a service shape override a base key requirement', () => {
  const contract = buildEnvContract({
    SENTRY_DSN: z.url(),
  });

  expect(contract.required).toContain('SENTRY_DSN');
  expect(contract.optional).not.toContain('SENTRY_DSN');
});

test('it derives the base contract alone from an empty shape', () => {
  const contract = buildEnvContract({});

  expect(contract).toStrictEqual({
    optional: ['LOG_LEVEL', 'OTEL_EXPORTER_OTLP_ENDPOINT', 'PORT', 'SENTRY_DSN'],
    required: ['SERVICE_AUTH_PUBLIC_KEY'],
  });
});
