import { QA_SIM_SPEED_MAX } from '@vers/contract-activity';
import type { WorkerClient, WorkerDebugSnapshot } from '@vers/idle-client';

interface QADebugSnapshot extends WorkerDebugSnapshot {
  readonly tab: { readonly tabID: string; readonly writerGeneration: number };
}

interface QADebugHook {
  readonly setSpeed: (speed: number) => Promise<number>;
  readonly snapshot: () => Promise<QADebugSnapshot>;
}

declare global {
  var __versQA: QADebugHook | undefined;
}

interface RegisterQADebugHookOptions {
  readonly client: WorkerClient;
  readonly isQAAvatar: boolean;
  readonly tabID: string;
  readonly writerGeneration: number;
}

export function registerQADebugHook(options: Readonly<RegisterQADebugHookOptions>): () => void {
  const hook: QADebugHook = {
    setSpeed: async (speed) => {
      if (!Number.isInteger(speed) || speed < 1 || speed > QA_SIM_SPEED_MAX) {
        throw new RangeError(`speed must be an integer from 1 to ${QA_SIM_SPEED_MAX}`);
      }

      const status = await options.client.setSimulationSpeed({
        isQAAvatar: options.isQAAvatar,
        speed,
      });

      if (status.kind === 'refused') {
        throw new Error('the active avatar is not flagged for QA, so it runs at real time only');
      }

      return status.speed;
    },
    snapshot: async () => {
      // the worker's answer is already a structured clone from the message port, so freezing the
      // merged object is what makes the whole snapshot read-only
      const worker = await options.client.readDebugSnapshot({});

      return Object.freeze({
        ...worker,
        tab: Object.freeze({ tabID: options.tabID, writerGeneration: options.writerGeneration }),
      });
    },
  };

  globalThis.__versQA = hook;

  return () => {
    if (globalThis.__versQA === hook) {
      Reflect.deleteProperty(globalThis, '__versQA');
    }
  };
}
