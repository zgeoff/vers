import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * The browser-side counterpart to `node.ts`'s server, for any flow that issues a request the
 * browser can see directly rather than through the `/api/rpc/$service` proxy (e.g. future
 * client-only tooling). Not started by this phase's boot path — the proxy route covers every
 * client-lane call today.
 */
export const worker = setupWorker(...handlers);
