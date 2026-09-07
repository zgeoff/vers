import type { CaptureEvent } from './types';

const BODY_LIMIT = 1500;

export function formatCaptureEvent(event: CaptureEvent): string {
  switch (event.kind) {
    case 'attached': {
      return `attached worker ${event.targetID}`;
    }
    case 'body': {
      return `   response ${event.url}: ${toClippedBody(event.body)}`;
    }
    case 'detached': {
      return `worker ${event.targetID} closed`;
    }
    case 'failure': {
      return `!! failed ${event.url}: ${event.reason}`;
    }
    case 'request': {
      return `>> ${event.method} ${event.url}\n   body: ${toClippedBody(event.body)}`;
    }
    case 'response': {
      break;
    }
  }

  return `<< ${event.status} ${event.url}`;
}

function toClippedBody(body: string): string {
  return body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT)}…` : body;
}
