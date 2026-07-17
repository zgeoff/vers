import { createWorkerRuntime } from './create-worker-runtime';
import { startErrorReporting } from './start-error-reporting';

declare let self: SharedWorkerGlobalScope;

// reporting boots in the background: a fault before init resolves is dropped rather than delaying
// the first connection
const dsn: string | undefined = import.meta.env['VITE_SENTRY_DSN'];

void startErrorReporting(dsn, { environment: import.meta.env.MODE });
const runtime = createWorkerRuntime();

self.addEventListener('connect', runtime.handleConnect);
