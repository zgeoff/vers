import { expect, test } from 'bun:test';
import { configureSync, getConfig } from '@logtape/logtape';
import { trace } from '@opentelemetry/api';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { updateEnv } from './update-env';

// the package preload registers the cleanup once for the whole process, so these tests see its
// effect across tests and depend on their order

test('it overrides an env var for this test only', () => {
  updateEnv('REGISTER_BUN_TEST_CLEANUP_PROBE', 'overridden');

  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBe('overridden');
});

test('it restores the previous test override via the registered global afterEach', () => {
  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBeUndefined();
});

test('it configures LogTape for this test only', () => {
  configureSync({
    loggers: [{ category: ['logtape', 'meta'], lowestLevel: 'warning' }],
    sinks: {},
  });

  expect(getConfig()).not.toBeNull();
});

test('it resets the previous test LogTape configuration via the registered global afterEach', () => {
  expect(getConfig()).toBeNull();
});

test.each(['first', 'second'])(
  'it lets the %s of two tests register its own global OpenTelemetry tracer provider',
  () => {
    expect(trace.setGlobalTracerProvider(new TracerProvider())).toBeTrue();
  },
);
