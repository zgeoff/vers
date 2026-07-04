import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { orpcClient } from './orpc-client';

/** TanStack Query bindings for the oRPC client: query options and keys derived from the contract. */
export const orpc = createTanstackQueryUtils(orpcClient);
