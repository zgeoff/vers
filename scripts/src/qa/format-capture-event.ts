import { match } from 'ts-pattern';
import type { CaptureEvent } from './types';

export function formatCaptureEvent(event: CaptureEvent): string {
  return match(event)
    .with({ kind: 'attached' }, (attached) => `attached worker ${attached.targetID}`)
    .with(
      { kind: 'body' },
      (received) => `   response ${received.url}: ${toClippedBody(received.body)}`,
    )
    .with({ kind: 'detached' }, (detached) => `worker ${detached.targetID} closed`)
    .with({ kind: 'failure' }, (failure) => `!! failed ${failure.url}: ${failure.reason}`)
    .with(
      { kind: 'request' },
      (request) => `>> ${request.method} ${request.url}\n   body: ${toClippedBody(request.body)}`,
    )
    .with({ kind: 'response' }, (response) => `<< ${response.status} ${response.url}`)
    .exhaustive();
}

const BODY_LIMIT = 1500;

function toClippedBody(body: string): string {
  return body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT)}…` : body;
}
