import { RPCLink } from '@orpc/client/fetch';
import type { AnyContractRouter } from '@orpc/contract';
import type { ServiceName } from '@vers/service-auth';
import { buildTracingInterceptor, makeIsRetryable } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from './create-edge-service-token';
import { loadSessionActor } from './load-session-actor';
import { makeBoundedFetch } from './make-bounded-fetch';
import { SERVICE_URLS } from './service-urls';
import type { AttemptClock, ServiceLinkContext } from './types';

export interface BuildServiceLinkOptions {
  readonly clock?: AttemptClock;
}

export function buildServiceLink(
  service: ServiceName,
  contract: AnyContractRouter,
  options: Readonly<BuildServiceLinkOptions> = {},
): RPCLink<ServiceLinkContext> {
  return new RPCLink<ServiceLinkContext>({
    clientInterceptors: [buildTracingInterceptor()],
    fetch: makeBoundedFetch({
      ...(options.clock !== undefined && { clock: options.clock }),
      isRetryable: makeIsRetryable(contract),
      service,
    }),
    headers: async (headerOptions) => {
      // an explicit acting user (login, force-logout) has no cookie session to name, so the token
      // carries no `sid` claim on that path
      const outcome =
        headerOptions.context.actingUserID === undefined ? await loadSessionActor() : undefined;

      const actor = outcome?.kind === 'actor' ? outcome : null;

      const actingUserID =
        headerOptions.context.actingUserID === undefined
          ? (actor?.userID ?? null)
          : headerOptions.context.actingUserID;

      const token = await createEdgeServiceToken({
        actingSessionID: actor?.sessionID ?? null,
        actingUserID,
        audience: service,
      });

      return { authorization: `Bearer ${token}` };
    },
    url: `${SERVICE_URLS[service]}/rpc`,
  });
}
