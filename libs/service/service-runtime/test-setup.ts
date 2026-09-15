import { afterEach } from 'bun:test';
import { metrics } from '@opentelemetry/api';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

registerBunTestCleanup();

// an OTel-enabled createService call registers a real global MeterProvider that `stopTelemetry`
// shuts down but never unregisters, so a later test's own provider registration is silently
// ignored without this reset
afterEach(() => {
  metrics.disable();
});
