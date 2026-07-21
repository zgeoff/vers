import { ClientMessageType } from '../types';
import type { ClientMessage } from './client-to-worker-message-schema';
import { clientToWorkerMessageSchema } from './client-to-worker-message-schema';
import { handleDisconnectMessage } from './handle-disconnect-message';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleReportOnlineMessage } from './handle-report-online-message';
import { handleSetFailureActionMessage } from './handle-set-failure-action-message';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { handleStopActivityMessage } from './handle-stop-activity-message';
import type { WorkerConnection, WorkerContext } from './types';

/**
 * Parses the raw event data once against the client-to-worker contract — only a bug on either end
 * of the shared-worker boundary can produce a malformed message, so a parse failure throws rather
 * than recovering.
 */
export async function handleClientMessage(
  context: WorkerContext,
  connection: WorkerConnection,
  event: MessageEvent<unknown>,
): Promise<void> {
  const message: ClientMessage = clientToWorkerMessageSchema.parse(event.data);

  switch (message.type) {
    case ClientMessageType.Disconnect: {
      handleDisconnectMessage(context, connection);
      break;
    }

    case ClientMessageType.Initialize: {
      handleInitializeMessage(context, message);
      break;
    }

    case ClientMessageType.ReportOnline: {
      await handleReportOnlineMessage(context, message);

      break;
    }

    case ClientMessageType.SetFailureAction: {
      await handleSetFailureActionMessage(context, message);

      break;
    }

    case ClientMessageType.StartActivity: {
      await handleStartActivityMessage(context, message);

      break;
    }

    case ClientMessageType.StopActivity: {
      await handleStopActivityMessage(context, message);

      break;
    }
  }
}
