import { expect, test } from 'bun:test';
import type { Logger } from '@openfeature/server-sdk';
import { ErrorCode } from '@openfeature/server-sdk';
import { updateEnv } from '@vers/test-utils/bun';
import { envFlagProvider } from './env-flag-provider';

function setupTest() {
  const logger: Logger = {
    debug() {},
    error() {},
    info() {},
    warn() {},
  };

  return { logger };
}

test('it resolves true when the env var is "true"', async () => {
  const ctx = setupTest();

  updateEnv('FEATURE_MARKET', 'true');

  const details = await envFlagProvider.resolveBooleanEvaluation('market', false, {}, ctx.logger);

  expect(details).toStrictEqual({ reason: 'STATIC', value: true });
});

test('it resolves false when the env var is "false"', async () => {
  const ctx = setupTest();

  updateEnv('FEATURE_MARKET', 'false');

  const details = await envFlagProvider.resolveBooleanEvaluation('market', true, {}, ctx.logger);

  expect(details).toStrictEqual({ reason: 'STATIC', value: false });
});

test('it falls back to the default value when the env var is unset', async () => {
  const ctx = setupTest();

  const details = await envFlagProvider.resolveBooleanEvaluation('market', true, {}, ctx.logger);

  expect(details).toStrictEqual({ reason: 'DEFAULT', value: true });
});

test('it falls back to the default value with a parse error when the env var is not "true" or "false"', async () => {
  const ctx = setupTest();

  updateEnv('FEATURE_MARKET', 'yes');

  const details = await envFlagProvider.resolveBooleanEvaluation('market', true, {}, ctx.logger);

  expect(details).toMatchObject({ errorCode: 'PARSE_ERROR', reason: 'ERROR', value: true });
});

test('it falls back to the default value with a not-found error for an unregistered flag key', async () => {
  const ctx = setupTest();

  const details = await envFlagProvider.resolveBooleanEvaluation(
    'unregistered',
    true,
    {},
    ctx.logger,
  );

  expect(details).toStrictEqual({
    errorCode: ErrorCode.FLAG_NOT_FOUND,
    reason: 'ERROR',
    value: true,
  });
});

test('it returns the default for string flags, since the registry is boolean-only', async () => {
  const ctx = setupTest();

  const details = await envFlagProvider.resolveStringEvaluation(
    'market',
    'fallback',
    {},
    ctx.logger,
  );

  expect(details).toStrictEqual({ errorCode: ErrorCode.GENERAL, value: 'fallback' });
});

test('it returns the default for number flags, since the registry is boolean-only', async () => {
  const ctx = setupTest();

  const details = await envFlagProvider.resolveNumberEvaluation('market', 0, {}, ctx.logger);

  expect(details).toStrictEqual({ errorCode: ErrorCode.GENERAL, value: 0 });
});

test('it returns the default for object flags, since the registry is boolean-only', async () => {
  const ctx = setupTest();

  const details = await envFlagProvider.resolveObjectEvaluation(
    'market',
    { enabled: false },
    {},
    ctx.logger,
  );

  expect(details).toStrictEqual({ errorCode: ErrorCode.GENERAL, value: { enabled: false } });
});
