import { WorkerMessageType } from '../types';
import { createBroadcastConnection } from './create-broadcast-connection';
import { createWorkerRuntime } from './create-worker-runtime';
import { startErrorReporting } from './start-error-reporting';
import { startWriterElection } from './start-writer-election';
import type { WorkerMessage } from './worker-to-client-message-schema';

// reporting boots in the background: a fault before init resolves is dropped rather than delaying
// the first connection
const dsn: string | undefined = import.meta.env['VITE_SENTRY_DSN'];

startWriterElection({
  locks: navigator.locks,
  onElected: () => {
    void startErrorReporting(dsn, { environment: import.meta.env.MODE });
    const runtime = createWorkerRuntime();
    const connection = createBroadcastConnection();

    runtime.registerConnection(connection);

    // announced after the connection registers, so a tab's re-sent handshake finds the runtime already listening
    connection.postMessage({ type: WorkerMessageType.WriterReady } satisfies WorkerMessage);
  },
});
