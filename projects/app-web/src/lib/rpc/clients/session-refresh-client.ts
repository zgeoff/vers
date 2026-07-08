import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import type { ServiceLinkContext } from '../build-service-link';
import { SERVICE_URLS } from '../service-urls';

/**
 * A bare session client for the token-refresh path: plain `fetch`, no `401` retry. The refresh
 * call must never ride the retrying fetch — a `401` from the refresh endpoint itself would
 * otherwise trigger another refresh, recursing without bound.
 */
export const sessionRefreshClient: ContractRouterClient<
  typeof sessionContract,
  ServiceLinkContext
> = createORPCClient(
  new RPCLink<ServiceLinkContext>({
    headers: (options) => options.context.headers ?? {},
    url: `${SERVICE_URLS.session}/rpc`,
  }),
);
