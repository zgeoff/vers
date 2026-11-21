import { afterEach, mock } from 'bun:test';
import { resetSync } from '@logtape/logtape';
import { context, propagation, trace } from '@opentelemetry/api';

export function registerBunTestCleanup(): void {
  afterEach(() => {
    mock.restore();

    resetSync();

    // the OpenTelemetry API keeps the first context manager, propagator, and tracer provider a
    // process registers, so one test's registration would otherwise shadow every later test's
    context.disable();
    propagation.disable();
    trace.disable();
  });
}
