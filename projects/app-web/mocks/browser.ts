import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * Browser-side MSW worker, for any flow that issues a request the browser sees directly rather
 * than through the `/api/rpc/$service` proxy. Not started by the current boot path — every
 * client-lane call round-trips through that proxy, so the server-side worker covers all traffic.
 */
export const worker = setupWorker(...handlers);
