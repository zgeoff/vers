import type { ClientMessage } from '../types';
import { handleDisconnectMessage } from './handle-disconnect-message';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { isDisconnectMessage } from './is-disconnect-message';
import { isInitializeMessage } from './is-initialize-message';
import { isSetActivityMessage } from './is-set-activity-message';
import type { WorkerContext } from './types';

export async function handleClientMessage(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerContext's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
  context: WorkerContext,
  port: MessagePort,
  event: MessageEvent<ClientMessage>,
): Promise<void> {
  if (isInitializeMessage(event.data)) {
    await handleInitializeMessage(context, event.data);
  }

  if (isSetActivityMessage(event.data)) {
    handleSetActivityMessage(context, event.data);
  }

  if (isDisconnectMessage(event.data)) {
    handleDisconnectMessage(context, port);
  }
}
