import type { ClientContext, InferClientContext, NestedClient } from '@orpc/client';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import { createTestAccessToken } from './create-test-access-token';
import { resolveServiceURL } from './resolve-service-url';

export async function createAuthedServiceClient<TClient extends NestedClient<ClientContext>>(
  service: ServiceName,
  userID: string,
): Promise<TClient> {
  const token = await createTestAccessToken(userID);

  const link = new RPCLink<InferClientContext<TClient>>({
    headers: { authorization: `Bearer ${token}` },
    url: `${resolveServiceURL(service)}/rpc`,
  });

  return createORPCClient<TClient>(link);
}
