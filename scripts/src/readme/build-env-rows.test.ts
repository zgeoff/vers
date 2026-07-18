import { expect, test } from 'bun:test';
import { buildEnvRows } from './build-env-rows';

test('it marks a schema that rejects undefined as required', () => {
  const rows = buildEnvRows({ DATABASE_URL: { safeParse: () => ({ success: false }) } });

  expect(rows).toStrictEqual([
    { defaultValue: undefined, description: '', key: 'DATABASE_URL', required: true },
  ]);
});

test('it marks a schema that accepts undefined as optional', () => {
  const rows = buildEnvRows({
    SENTRY_DSN: { safeParse: () => ({ data: undefined, success: true }) },
  });

  expect(rows).toStrictEqual([
    { defaultValue: undefined, description: '', key: 'SENTRY_DSN', required: false },
  ]);
});

test('it records the value a defaulting schema produces', () => {
  const rows = buildEnvRows({ PORT: { safeParse: () => ({ data: 3000, success: true }) } });

  expect(rows).toStrictEqual([
    { defaultValue: '3000', description: '', key: 'PORT', required: false },
  ]);
});

test('it reads the description off the schema', () => {
  const rows = buildEnvRows({
    ROLL_KEY_ROOTS: {
      description: 'root secrets by population',
      safeParse: () => ({ success: false }),
    },
  });

  expect(rows).toStrictEqual([
    {
      defaultValue: undefined,
      description: 'root secrets by population',
      key: 'ROLL_KEY_ROOTS',
      required: true,
    },
  ]);
});

test('it falls back to registry metadata for the description', () => {
  const rows = buildEnvRows({
    API_IDENTIFIER: {
      meta: () => ({ description: 'token issuer and audience' }),
      safeParse: () => ({ success: false }),
    },
  });

  expect(rows).toStrictEqual([
    {
      defaultValue: undefined,
      description: 'token issuer and audience',
      key: 'API_IDENTIFIER',
      required: true,
    },
  ]);
});

test('it sorts rows by variable name', () => {
  const rows = buildEnvRows({
    ZED: { safeParse: () => ({ success: false }) },
    ALPHA: { safeParse: () => ({ success: false }) },
  });

  expect(rows.map((row) => row.key)).toStrictEqual(['ALPHA', 'ZED']);
});
