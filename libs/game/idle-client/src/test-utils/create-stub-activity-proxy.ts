import { RPCHandler } from '@orpc/server/fetch';
import { activityRouter } from '@vers/mock-services/activity';
import type { HttpHandler } from 'msw';
import { http } from 'msw';

const PROXY_PREFIX = '/api/rpc/activity';

export function createStubActivityProxy(actingUserID: string): HttpHandler {
  const rpcHandler = new RPCHandler(activityRouter);

  // answers at the path the worker's own service client posts to, resolving the session to the
  // given user the way app-web's proxy resolves its cookie
  return http.all(`${self.location.origin}${PROXY_PREFIX}/*`, async (info) => {
    const handled = await rpcHandler.handle(info.request, {
      context: { actingUserID },
      prefix: PROXY_PREFIX,
    });

    return handled.matched ? handled.response : new Response(null, { status: 404 });
  });
}
