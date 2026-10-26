import { afterEach } from 'bun:test';
import { setImmediate } from 'node:timers/promises';
import { metrics } from '@opentelemetry/api';
import { registerBunTestCleanup } from '@vers/test-utils/bun';

// Elysia runs a request's afterResponse hooks on a later macrotask, and the OTel plugin's hook
// writes its span into the active context; registered first so it runs before the shared cleanup
// disables the context manager, after which that context is the process-wide root
afterEach(async () => {
  await setImmediate();
});

registerBunTestCleanup();

// an OTel-enabled createService call registers a real global MeterProvider that the service's
// stop shuts down but never unregisters, so a later test's own provider registration is silently
// ignored without this reset
afterEach(() => {
  metrics.disable();
});
