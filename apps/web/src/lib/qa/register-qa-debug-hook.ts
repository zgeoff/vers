import type { WorkerClient, WorkerDebugSnapshot } from '@vers/idle-client';

interface QADebugSnapshot extends WorkerDebugSnapshot {
  readonly tab: { readonly tabID: string; readonly writerGeneration: number };
}

interface QADebugHook {
  readonly snapshot: () => Promise<QADebugSnapshot>;
}

declare global {
  var __versQA: QADebugHook | undefined;
}

interface RegisterQADebugHookOptions {
  readonly client: WorkerClient;
  readonly tabID: string;
  readonly writerGeneration: number;
}

export function registerQADebugHook(options: Readonly<RegisterQADebugHookOptions>): () => void {
  const hook: QADebugHook = {
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
