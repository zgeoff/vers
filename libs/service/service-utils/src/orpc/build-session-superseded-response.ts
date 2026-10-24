import { ORPCError } from '@orpc/client';
import { StandardRPCJsonSerializer, StandardRPCSerializer } from '@orpc/client/standard';
import { SESSION_SUPERSEDED_HEADER } from './session-superseded-header';

const rpcSerializer = new StandardRPCSerializer(new StandardRPCJsonSerializer());

export function buildSessionSupersededResponse(): Response {
  // a defined error in the RPC wire format: an empty body decodes as an undefined error, which a
  // client reads as a lost connection rather than the server's refusal
  const error = new ORPCError('UNAUTHORIZED', {
    data: { reason: 'missing-session' },
    defined: true,
  });

  return Response.json(rpcSerializer.serialize(error.toJSON()), {
    headers: { [SESSION_SUPERSEDED_HEADER]: '1' },
    status: error.status,
  });
}
