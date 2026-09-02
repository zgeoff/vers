import { metrics } from '@opentelemetry/api';

export function recordWriterTakeover(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.writer_takeovers', {
      description: 'successful writer-session claims on active activities',
      unit: '{takeover}',
    });

  counter.add(1);
}
