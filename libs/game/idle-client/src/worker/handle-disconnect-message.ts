import type { WorkerConnection, WorkerContext } from './types';

/**
 * Chrome fires MessagePort's `close` event when its peer disconnects (shipped 2024); Firefox and
 * Safari support is unconfirmed and Bun fires no `close` event at all, so this explicit message is
 * the only disconnect path every environment and test can rely on. Only the SharedWorker transport
 * ever sends it — over the fallback's broadcast bridge, closing the runtime's one connection would
 * sever every tab at once.
 */
export function handleDisconnectMessage(context: WorkerContext, connection: WorkerConnection) {
  context.removeConnection(connection);
  connection.close();
}
