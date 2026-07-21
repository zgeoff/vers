import { expect, onTestFinished, test } from 'bun:test';
import type { ContractRouterClient } from '@orpc/contract';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { updateEnv } from '@vers/test-utils/bun';
import * as jose from 'jose';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import { createAuthedServiceClient } from './create-authed-service-client';

test("it mints a client whose calls carry the user's bearer token to the service's rpc mount", async () => {
  // an echo contract served on a real localhost port under `/rpc`, its one procedure reporting
  // back the `authorization` header it received
  const contract = {
    echoAuthorization: oc.output(z.object({ authorization: z.string().nullable() })),
  };

  const os = implement(contract).$context<{ authorization: null | string }>();

  const handler = new RPCHandler({
    echoAuthorization: os.echoAuthorization.handler((opts) => ({
      authorization: opts.context.authorization,
    })),
  });

  const server = Bun.serve({
    fetch: async (request) => {
      const result = await handler.handle(request, {
        context: { authorization: request.headers.get('authorization') },
        prefix: '/rpc',
      });

      return result.matched ? result.response : new Response('not found', { status: 404 });
    },
    port: 0,
  });

  onTestFinished(() => {
    void server.stop();
  });

  updateEnv('ACTIVITY_SERVICE_URL', `http://localhost:${server.port}`);

  const client = await createAuthedServiceClient<ContractRouterClient<typeof contract>>(
    'activity',
    'user-1',
  );

  const result = await client.echoAuthorization({});

  invariant(result.authorization !== null, 'expected the call to carry an authorization header');

  expect(result.authorization).toStartWith('Bearer ');

  const payload = jose.decodeJwt(result.authorization.slice('Bearer '.length));

  expect(payload.sub).toBe('user-1');
});
