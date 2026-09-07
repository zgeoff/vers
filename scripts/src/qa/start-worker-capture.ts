import { pickCaptureTargets } from './pick-capture-targets';
import { readDevToolsTargets } from './read-devtools-targets';
import { subscribeToWorkerTraffic } from './subscribe-to-worker-traffic';
import type { CDPClient } from './types';

const POLL_INTERVAL_MS = 1000;

interface CaptureConfig {
  readonly endpoint: string;
  readonly pathFilter: string;
  readonly print: (line: string) => void;
  readonly workerURL?: string;
}

export function startWorkerCapture(config: CaptureConfig): () => void {
  const attached = new Set<string>();
  const clients = new Set<CDPClient>();

  const runPoll = async (): Promise<void> => {
    try {
      const targets = await readDevToolsTargets(config.endpoint);

      const picked = pickCaptureTargets(targets, {
        attached,
        ...(config.workerURL !== undefined && { workerURL: config.workerURL }),
      });

      for (const target of picked) {
        attached.add(target.id);

        void (async () => {
          try {
            const client = await subscribeToWorkerTraffic(target, config);

            clients.add(client);

            await client.closed;

            clients.delete(client);
          } catch (error) {
            config.print(`attach ${target.id} failed: ${toMessage(error)}`);
          } finally {
            attached.delete(target.id);
          }
        })();
      }
    } catch (error) {
      config.print(`poll failed: ${toMessage(error)}`);
    }
  };

  void runPoll();

  const timer = setInterval(() => {
    void runPoll();
  }, POLL_INTERVAL_MS);

  return () => {
    clearInterval(timer);

    for (const client of clients) {
      client.close();
    }
  };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
