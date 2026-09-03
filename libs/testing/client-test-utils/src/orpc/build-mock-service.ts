import type { AnyContractRouter } from '@orpc/contract';
import type { Router } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { HttpHandler } from 'msw';
import { http } from 'msw';
import { RPC_PREFIX } from './rpc-prefix';

export interface BuildMockServiceOptions<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
> {
  baseUrl: string;

  contract: TContract;

  resolveContext: (request: Request) => TContext | Promise<TContext>;

  router: Router<TContract, TContext>;
}

export function buildMockService<
  TContract extends AnyContractRouter,
  TContext extends Record<string, unknown>,
>(options: Readonly<BuildMockServiceOptions<TContract, TContext>>): Array<HttpHandler> {
  const rpcHandler = new RPCHandler<TContext>(options.router);

  return [
    http.all(`${options.baseUrl}${RPC_PREFIX}/*`, async (info) => {
      const context = await options.resolveContext(info.request);

      const handled = await rpcHandler.handle(info.request, {
        context,
        prefix: RPC_PREFIX,
      });

      return handled.matched ? handled.response : new Response(null, { status: 404 });
    }),
  ];
}
