import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { RPCHandler } from '@orpc/server/fetch';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { userContract } from '@vers/contract-user';
import { Elysia } from 'elysia';
import { buildSessionFromRequest } from './build-session-from-request';
import { userRouter } from './user-router';

/**
 * Serves the user service over both oRPC transports: the RPC protocol under /rpc (consumed by
 * typed clients) and the OpenAPI-shaped REST surface under /api, plus the generated OpenAPI
 * document at /spec.json. The spec is generated from the contract alone — no implementation
 * types involved — which is what lets a client package depend on the contract only.
 */
const rpcHandler = new RPCHandler(userRouter);
const openAPIHandler = new OpenAPIHandler(userRouter);

const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await openAPIGenerator.generate(userContract, {
  info: { title: 'vers user service (spike)', version: '0.0.0' },
});

const port = Number(process.env.PORT ?? 3001);

const app = new Elysia()
  .all(
    '/rpc*',
    async ({ request }) => {
      const { response } = await rpcHandler.handle(request, {
        prefix: '/rpc',
        context: { session: buildSessionFromRequest(request) },
      });
      return response ?? new Response('Not Found', { status: 404 });
    },
    { parse: 'none' },
  )
  .all(
    '/api*',
    async ({ request }) => {
      const { response } = await openAPIHandler.handle(request, {
        prefix: '/api',
        context: { session: buildSessionFromRequest(request) },
      });
      return response ?? new Response('Not Found', { status: 404 });
    },
    { parse: 'none' },
  )
  .get('/spec.json', () => spec)
  .listen(port);

console.log(`user service listening on http://localhost:${app.server?.port}`);
