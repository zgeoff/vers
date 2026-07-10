import { expect, test } from 'bun:test';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import * as z from 'zod';
import { buildRPCTestClient } from './build-rpc-test-client';

test('it sends the token as a bearer authorization header', async () => {
  const client = buildRPCTestClient<TestContract>(buildEchoApp(), { token: 'test-token' });

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBe('Bearer test-token');
});

test('it lets an explicit header override the token-derived authorization header', async () => {
  const client = buildRPCTestClient<TestContract>(buildEchoApp(), {
    headers: { authorization: 'Bearer explicit-header' },
    token: 'test-token',
  });

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBe('Bearer explicit-header');
});

test('it sends no authorization header when no token is given', async () => {
  const client = buildRPCTestClient<TestContract>(buildEchoApp());

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBeNull();
});

function buildTestContract() {
  return {
    echoAuthorization: oc.output(z.object({ authorization: z.string().nullable() })),
  };
}

type TestContract = ReturnType<typeof buildTestContract>;

/**
 * An app (in the shape `buildRPCTestClient` requires) whose one procedure reports back the `authorization` header it received.
 */
function buildEchoApp(): { handle: (request: Request) => Promise<Response> } {
  const os = implement(buildTestContract()).$context<{ authorization: null | string }>();

  const router = {
    echoAuthorization: os.echoAuthorization.handler((opts) => ({
      authorization: opts.context.authorization,
    })),
  };

  const handler = new RPCHandler(router);

  return {
    handle: async (request) => {
      const result = await handler.handle(request, {
        context: { authorization: request.headers.get('authorization') },
        prefix: '/rpc',
      });

      return result.matched ? result.response : new Response('not found', { status: 404 });
    },
  };
}
