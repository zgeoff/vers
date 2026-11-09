import { recordQARequestRefusal } from '../metrics/record-qa-request-refusal';
import { createEdgeServiceToken } from '../rpc/create-edge-service-token';
import { forwardServiceRequest } from '../rpc/forward-service-request';
import { SERVICE_URLS } from '../rpc/service-urls';
import type { AttemptClock } from '../rpc/types';
import { pickQARequestRefusal } from './pick-qa-request-refusal';
import type { QARequestRefusal } from './types';

export interface SendQARequestOptions {
  readonly clock?: AttemptClock;
  readonly configuredToken: string | undefined;
}

const QA_PATH_PREFIX = '/api/qa';

const REFUSAL_STATUS: Readonly<Record<QARequestRefusal, number>> = {
  disabled: 404,
  unauthorized: 401,
  'unknown-procedure': 404,
};

export async function sendQARequest(
  request: Request,
  options: Readonly<SendQARequestOptions>,
): Promise<Response> {
  const procedurePath = new URL(request.url).pathname
    .slice(QA_PATH_PREFIX.length)
    .split('/')
    .filter((segment) => segment !== '');

  const refusal = pickQARequestRefusal({
    authorization: request.headers.get('authorization'),
    configuredToken: options.configuredToken,
    procedurePath,
  });

  if (refusal !== null) {
    recordQARequestRefusal(refusal);

    return new Response(null, { status: REFUSAL_STATUS[refusal] });
  }

  const token = await createEdgeServiceToken({
    actingUserID: null,
    audience: 'activity',
    scope: 'qa:seed',
  });

  return forwardServiceRequest(request, {
    ...(options.clock !== undefined && { clock: options.clock }),
    retryable: false,
    service: 'activity',
    target: new URL('/rpc/createQAAccount', SERVICE_URLS.activity),
    token,
  });
}
