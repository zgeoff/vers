import { z } from 'zod';
import { buildTargetSocketURL } from './build-target-socket-url';
import { createCDPClient } from './create-cdp-client';
import { formatCaptureEvent } from './format-capture-event';
import { formatConsoleEvent } from './format-console-event';
import type { CDPClient, CDPEvent, DevToolsTarget } from './types';

interface TrafficConfig {
  readonly endpoint: string;
  readonly pathFilter: string;
  readonly print: (line: string) => void;
}

const requestSentSchema = z.object({
  request: z.object({
    method: z.string(),
    postData: z.string().optional(),
    url: z.string(),
  }),
  requestId: z.string(),
});

const responseReceivedSchema = z.object({
  requestId: z.string(),
  response: z.object({ status: z.number() }),
});

const loadingFinishedSchema = z.object({ requestId: z.string() });
const loadingFailedSchema = z.object({ errorText: z.string(), requestId: z.string() });
const responseBodySchema = z.object({ body: z.string() });

export async function subscribeToWorkerTraffic(
  target: DevToolsTarget,
  config: TrafficConfig,
): Promise<CDPClient> {
  const client = await createCDPClient(buildTargetSocketURL(target, config.endpoint));

  const urlsByRequest = new Map<string, string>();

  const printEvent = async (event: CDPEvent): Promise<void> => {
    switch (event.method) {
      case 'Network.requestWillBeSent': {
        const sent = requestSentSchema.parse(event.params);

        if (sent.request.url.includes(config.pathFilter)) {
          urlsByRequest.set(sent.requestId, sent.request.url);

          config.print(
            formatCaptureEvent({
              body: sent.request.postData ?? '',
              kind: 'request',
              method: sent.request.method,
              url: sent.request.url,
            }),
          );
        }

        return;
      }
      case 'Network.responseReceived': {
        const received = responseReceivedSchema.parse(event.params);
        const url = urlsByRequest.get(received.requestId);

        if (url !== undefined) {
          config.print(
            formatCaptureEvent({ kind: 'response', status: received.response.status, url }),
          );
        }

        return;
      }
      case 'Network.loadingFinished': {
        const finished = loadingFinishedSchema.parse(event.params);
        const url = urlsByRequest.get(finished.requestId);

        if (url !== undefined) {
          urlsByRequest.delete(finished.requestId);

          const raw = await client.send('Network.getResponseBody', {
            requestId: finished.requestId,
          });

          config.print(
            formatCaptureEvent({ body: responseBodySchema.parse(raw).body, kind: 'body', url }),
          );
        }

        return;
      }
      case 'Network.loadingFailed': {
        const failed = loadingFailedSchema.parse(event.params);
        const url = urlsByRequest.get(failed.requestId);

        if (url !== undefined) {
          urlsByRequest.delete(failed.requestId);
          config.print(formatCaptureEvent({ kind: 'failure', reason: failed.errorText, url }));
        }

        return;
      }
      default: {
        const line = formatConsoleEvent(event);

        if (line !== null) {
          config.print(line);
        }
      }
    }
  };

  client.subscribe((event) => {
    void (async () => {
      try {
        await printEvent(event);
      } catch (error) {
        config.print(`capture ${target.id}: ${toMessage(error)}`);
      }
    })();
  });

  await client.send('Network.enable');
  await client.send('Runtime.enable');

  config.print(formatCaptureEvent({ kind: 'attached', targetID: target.id }));

  void (async () => {
    await client.closed;

    config.print(formatCaptureEvent({ kind: 'detached', targetID: target.id }));
  })();

  return client;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
