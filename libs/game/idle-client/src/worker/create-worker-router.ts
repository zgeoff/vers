import { implement } from '@orpc/server';
import { handleCacheNodeSeedsMessage } from './handle-cache-node-seeds-message';
import { handleDisconnectMessage } from './handle-disconnect-message';
import { handleInitializeMessage } from './handle-initialize-message';
import { handleReadUndeliveredWorkMessage } from './handle-read-undelivered-work-message';
import { handleRemoveUndeliveredWorkMessage } from './handle-remove-undelivered-work-message';
import { handleReportOnlineMessage } from './handle-report-online-message';
import { handleSetFailureActionMessage } from './handle-set-failure-action-message';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { handleStopActivityMessage } from './handle-stop-activity-message';
import type { WorkerCallContext, WorkerContext } from './types';
import { workerContract } from './worker-contract';

const ACK = { ok: true as const };

export function createWorkerRouter(context: WorkerContext, ready: Readonly<Promise<void>>) {
  const os = implement(workerContract).$context<WorkerCallContext>();

  return {
    cacheNodeSeeds: os.cacheNodeSeeds.handler(async (opts) => {
      await ready;
      await handleCacheNodeSeedsMessage(opts.input);

      return ACK;
    }),

    disconnect: os.disconnect.handler(async (opts) => {
      await ready;

      handleDisconnectMessage(opts.context);

      return ACK;
    }),

    initialize: os.initialize.handler(async () => {
      await ready;

      return handleInitializeMessage(context);
    }),

    readUndeliveredWork: os.readUndeliveredWork.handler(async () => {
      await ready;

      return handleReadUndeliveredWorkMessage();
    }),

    removeUndeliveredWork: os.removeUndeliveredWork.handler(async () => {
      await ready;
      await handleRemoveUndeliveredWorkMessage(context);

      return ACK;
    }),

    reportOnline: os.reportOnline.handler(async (opts) => {
      await ready;
      await handleReportOnlineMessage(context, opts.input);

      return ACK;
    }),

    setFailureAction: os.setFailureAction.handler(async (opts) => {
      await ready;

      return handleSetFailureActionMessage(context, opts.input);
    }),

    startActivity: os.startActivity.handler(async (opts) => {
      await ready;

      return handleStartActivityMessage(context, opts.input);
    }),

    stopActivity: os.stopActivity.handler(async (opts) => {
      await ready;
      await handleStopActivityMessage(context, opts.input);

      return ACK;
    }),
  };
}
