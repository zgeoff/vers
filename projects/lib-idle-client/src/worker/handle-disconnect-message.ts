import type { WorkerContext } from './types';

/**
 * Chrome fires MessagePort's `close` event when its peer disconnects (shipped 2024); Firefox and
 * Safari support is unconfirmed and Bun fires no `close` event at all, so this explicit message is
 * the only disconnect path every environment and test can rely on.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerContext's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
export function handleDisconnectMessage(context: WorkerContext, port: MessagePort) {
  context.removeConnection(port);
  port.close();
}
