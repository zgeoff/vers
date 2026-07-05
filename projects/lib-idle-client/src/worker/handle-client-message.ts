import type { ClientMessage } from '../types';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { isInitializeMessage } from './is-initialize-message';
import { isSetActivityMessage } from './is-set-activity-message';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function handleClientMessage(event: MessageEvent<ClientMessage>): Promise<void> {
  console.log('-- received message type', event.data.type);

  if (isInitializeMessage(event.data)) {
    await handleInitializeMessage(event.data);
  }

  if (isSetActivityMessage(event.data)) {
    handleSetActivityMessage(event.data);
  }
}
