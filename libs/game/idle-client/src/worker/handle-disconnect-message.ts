import type { WorkerCallContext } from './types';

/**
 * Releases whatever the transport holds for the calling connection: the real port on the
 * `SharedWorker` path, this tab's entry in the web-locks demux's registry on the other. `RPCLink`
 * has no close-notify of its own, so a tab calls this from its `pagehide` handler as the only
 * reliable teardown signal every environment delivers.
 */
export function handleDisconnectMessage(callContext: WorkerCallContext): void {
  // deferred to a macrotask — closing synchronously here would race this very call's own answer,
  // which still has to go out over the same connection
  setTimeout(() => {
    callContext.close();
  }, 0);
}
