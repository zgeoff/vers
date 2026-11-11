import type { ServiceName } from '@vers/service-auth';
import { buildSessionSupersededResponse } from '@vers/service-utils/orpc';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { forwardServiceRequest } from '../rpc/forward-service-request';
import { loadSessionActor } from '../rpc/load-session-actor';
import { SERVICE_URLS } from '../rpc/service-urls';
import type { AttemptClock } from '../rpc/types';
import { isProxiedProcedure } from './is-proxied-procedure';
import { isProxiedService } from './is-proxied-service';
import { isRetryableProxyCall } from './is-retryable-proxy-call';

export interface SendRPCRequestOptions {
  readonly clock?: AttemptClock;
}

export async function sendRPCRequest(
  request: Request,
  service: ServiceName,
  options: Readonly<SendRPCRequestOptions> = {},
): Promise<Response> {
  if (!isProxiedService(service)) {
    return new Response(null, { status: 404 });
  }

  const incoming = new URL(request.url);

  const prefix = `/api/rpc/${service}`;

  const procedurePath = incoming.pathname
    .slice(prefix.length)
    .split('/')
    .filter((segment) => segment !== '');

  if (!isProxiedProcedure(service, procedurePath)) {
    return new Response(null, { status: 404 });
  }

  const outcome = await loadSessionActor();

  // a session deleted before its expiry is answered here, not forwarded: only this side can tell a
  // deletion from an expiry, and the header tells the caller to discard its offline work. A plain
  // expiry gets the service's own 401 with no header, so the caller keeps that work.
  if (outcome.kind === 'superseded') {
    return buildSessionSupersededResponse();
  }

  const actor = outcome.kind === 'actor' ? outcome : null;

  const token = await createEdgeServiceToken({
    actingSessionID: actor?.sessionID ?? null,
    actingUserID: actor?.userID ?? null,
    audience: service,
  });

  return forwardServiceRequest(request, {
    ...(options.clock !== undefined && { clock: options.clock }),
    retryable: isRetryableProxyCall(service, procedurePath),
    service,
    target: new URL(
      incoming.pathname.replace(prefix, '/rpc') + incoming.search,
      SERVICE_URLS[service],
    ),
    token,
  });
}
