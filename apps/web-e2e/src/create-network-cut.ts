import type { Browser, BrowserContext } from '@playwright/test';
import * as z from 'zod';

interface NetworkCut {
  readonly end: () => Promise<void>;
  readonly readWorkerFetches: () => Promise<ReadonlyArray<string>>;
  readonly workerCount: number;
}

const WORKER_TARGET_TYPES: ReadonlySet<string> = new Set(['service_worker', 'shared_worker']);

const TargetInfoSchema = z.object({ targetId: z.string(), type: z.string() });
const TargetsSchema = z.object({ targetInfos: z.array(TargetInfoSchema) });
const AttachedSchema = z.object({ sessionId: z.string() });
const ReceivedSchema = z.object({ message: z.string(), sessionId: z.string() });

const ReplySchema = z.object({
  error: z.object({ message: z.string() }).optional(),
  id: z.int(),
  result: z.unknown().optional(),
});

type Reply = z.infer<typeof ReplySchema>;

const EvaluateResultSchema = z.object({ result: z.object({ value: z.string() }) });

const FETCH_EXPRESSION = `fetch(self.location.origin + '/', { cache: 'no-store' }).then(
  (response) => 'answered ' + response.status,
  (error) => 'failed ' + error.name,
)`;

// airplane mode takes the network from every context of the device at once, and Playwright's
// offline mode never reaches a SharedWorker or a service worker. Chrome drops a DevTools network
// emulation when the session that set it detaches, so one session holds the cut until `end`.
export async function createNetworkCut(
  browser: Browser,
  context: BrowserContext,
): Promise<NetworkCut> {
  await context.setOffline(true);

  const session = await browser.newBrowserCDPSession();
  const targetsReply = await session.send('Target.getTargets');

  const targets = TargetsSchema.parse(targetsReply);
  const workers = targets.targetInfos.filter((target) => WORKER_TARGET_TYPES.has(target.type));

  const pending = new Map<number, (reply: Reply) => void>();

  let nextMessageID = 1;

  // a message sent into a worker's session settles when the browser routes it, not when the
  // worker applies it, so each command waits for the worker's own reply
  session.on('Target.receivedMessageFromTarget', (event) => {
    const received = ReceivedSchema.parse(event);
    const reply = ReplySchema.safeParse(JSON.parse(received.message));

    if (reply.success) {
      pending.get(reply.data.id)?.(reply.data);
      pending.delete(reply.data.id);
    }
  });

  const workerSessionIDs = await Promise.all(
    workers.map(async (worker) => {
      const attachedReply = await session.send('Target.attachToTarget', {
        flatten: false,
        targetId: worker.targetId,
      });

      return AttachedSchema.parse(attachedReply).sessionId;
    }),
  );

  const sendToWorker = async (sessionId: string, method: string, params: object) => {
    const messageID = nextMessageID;

    nextMessageID += 1;

    const replied = Promise.withResolvers<Reply>();

    pending.set(messageID, replied.resolve);

    await session.send('Target.sendMessageToTarget', {
      message: JSON.stringify({ id: messageID, method, params }),
      sessionId,
    });

    const reply = await replied.promise;

    if (reply.error !== undefined) {
      throw new Error(`${method} failed in a worker: ${reply.error.message}`);
    }

    return reply.result;
  };

  const sendToWorkers = (method: string, params: object) =>
    Promise.all(workerSessionIDs.map((sessionId) => sendToWorker(sessionId, method, params)));

  const networkConditions = { downloadThroughput: -1, latency: 0, uploadThroughput: -1 };

  await sendToWorkers('Network.enable', {});
  await sendToWorkers('Network.emulateNetworkConditions', { ...networkConditions, offline: true });

  return {
    end: async () => {
      await sendToWorkers('Network.emulateNetworkConditions', {
        ...networkConditions,
        offline: false,
      });

      await session.detach();
      await context.setOffline(false);
    },
    readWorkerFetches: async () => {
      const results = await sendToWorkers('Runtime.evaluate', {
        awaitPromise: true,
        expression: FETCH_EXPRESSION,
        returnByValue: true,
      });

      return results.map((result) => EvaluateResultSchema.parse(result).result.value);
    },
    workerCount: workers.length,
  };
}
