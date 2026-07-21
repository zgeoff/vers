import { WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import { WorkerMessageType } from '../types';
import { createWorkerDemux } from './create-worker-demux';
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

    createWorkerDemux({ upgrade: runtime.upgrade });

    const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

    // announced after the demux is ready to serve, so a tab's re-sent handshake finds it already
    // listening
    channel.postMessage({ type: WorkerMessageType.WriterReady } satisfies WorkerMessage);
  },
});
