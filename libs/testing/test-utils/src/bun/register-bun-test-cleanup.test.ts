import { expect, test } from 'bun:test';
import { configureSync, getConfig } from '@logtape/logtape';
import { trace } from '@opentelemetry/api';
import { TracerProvider } from '@opentelemetry/sdk-trace';

// the package preload registers the cleanup once for the whole process, so these tests see its
// effect across tests and depend on their order

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
