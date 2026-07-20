import type { ClientMessage } from '../types';
import { handleDisconnectMessage } from './handle-disconnect-message';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleRequestFlushMessage } from './handle-request-flush-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { handleSetFailureActionMessage } from './handle-set-failure-action-message';
import { handleStopActivityMessage } from './handle-stop-activity-message';
import { isDisconnectMessage } from './is-disconnect-message';
import { isInitializeMessage } from './is-initialize-message';
import { isRequestFlushMessage } from './is-request-flush-message';
import { isRequestResyncMessage } from './is-request-resync-message';
import { isSetActivityMessage } from './is-set-activity-message';
import { isSetFailureActionMessage } from './is-set-failure-action-message';
import { isStopActivityMessage } from './is-stop-activity-message';
import type { WorkerContext } from './types';

export async function handleClientMessage(
  context: WorkerContext,
  port: MessagePort,
  event: MessageEvent<ClientMessage>,
): Promise<void> {
  if (isInitializeMessage(event.data)) {
    handleInitializeMessage(context, event.data);
  }

  if (isSetActivityMessage(event.data)) {
    await handleSetActivityMessage(context, event.data);
  }

  if (isSetFailureActionMessage(event.data)) {
    await handleSetFailureActionMessage(context, event.data);
  }

  if (isStopActivityMessage(event.data)) {
    await handleStopActivityMessage(context, event.data);
  }

  if (isRequestResyncMessage(event.data)) {
    await handleRequestResyncMessage(context, event.data);
  }

  if (isRequestFlushMessage(event.data)) {
    await handleRequestFlushMessage(context, port, event.data);
  }

  if (isDisconnectMessage(event.data)) {
    handleDisconnectMessage(context, port);
  }
}
