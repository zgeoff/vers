import type { Browser } from '@playwright/test';
import * as z from 'zod';

interface SharedWorkerOutage {
  readonly end: () => Promise<void>;
  readonly workerCount: number;
}

const TargetInfoSchema = z.object({ targetId: z.string(), type: z.string() });
const TargetsSchema = z.object({ targetInfos: z.array(TargetInfoSchema) });
const AttachedSchema = z.object({ sessionId: z.string() });

// Playwright's offline mode covers pages and dedicated workers but never a SharedWorker, so the
// outage sets each shared worker's network conditions through the browser's DevTools protocol. An
// emulation belongs to the session that set it, so the same session ends it.
export async function createSharedWorkerOutage(browser: Browser): Promise<SharedWorkerOutage> {
  const session = await browser.newBrowserCDPSession();
  const targetsReply = await session.send('Target.getTargets');

  const targets = TargetsSchema.parse(targetsReply);
  const sharedWorkers = targets.targetInfos.filter((target) => target.type === 'shared_worker');

  const workerSessionIDs = await Promise.all(
    sharedWorkers.map(async (sharedWorker) => {
      const attachedReply = await session.send('Target.attachToTarget', {
        flatten: false,
        targetId: sharedWorker.targetId,
      });

      return AttachedSchema.parse(attachedReply).sessionId;
    }),
  );

  const sendToWorkers = async (id: number, method: string, params: object) => {
    const message = JSON.stringify({ id, method, params });

    await Promise.all(
      workerSessionIDs.map((sessionId) =>
        session.send('Target.sendMessageToTarget', { message, sessionId }),
      ),
    );
  };

  const networkConditions = { downloadThroughput: -1, latency: 0, uploadThroughput: -1 };

  await sendToWorkers(1, 'Network.enable', {});

  await sendToWorkers(2, 'Network.emulateNetworkConditions', {
    ...networkConditions,
    offline: true,
  });

  return {
    end: async () => {
      await sendToWorkers(3, 'Network.emulateNetworkConditions', {
        ...networkConditions,
        offline: false,
      });

      await session.detach();
    },
    workerCount: sharedWorkers.length,
  };
}
