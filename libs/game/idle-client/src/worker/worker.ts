import { createWorkerRuntime } from './create-worker-runtime';
import { createWriterGate } from './create-writer-gate';
import { startErrorReporting } from './start-error-reporting';

declare let self: SharedWorkerGlobalScope;

// reporting boots in the background: a fault before init resolves is dropped rather than delaying
// the first connection
const dsn: string | undefined = import.meta.env['VITE_SENTRY_DSN'];

const gate = createWriterGate({
  createRuntime: () => {
    void startErrorReporting(dsn, { environment: import.meta.env.MODE });

    return createWorkerRuntime();
  },
  locks: navigator.locks,
});

self.addEventListener('connect', gate.handleConnect);
