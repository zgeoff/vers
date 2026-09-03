import { RPCLink } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import type { ServiceLinkContext } from './types';

export function buildProxyServiceLink(service: ServiceName): RPCLink<ServiceLinkContext> {
  return new RPCLink<ServiceLinkContext>({
    headers: () => ({ traceparent: buildTraceparent(createTraceContext()) }),
    url: `${globalThis.location.origin}/api/rpc/${service}`,
  });
}
