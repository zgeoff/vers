import { expect, test } from 'bun:test';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import * as z from 'zod';
import { buildRPCTestClient } from './build-rpc-test-client';

function setupTest() {
  const contract = {
    echoAuthorization: oc.output(z.object({ authorization: z.string().nullable() })),
  };

  const os = implement(contract).$context<{ authorization: null | string }>();

  const handler = new RPCHandler({
    echoAuthorization: os.echoAuthorization.handler((opts) => ({
      authorization: opts.context.authorization,
    })),
  });

  const handleRequest = async (request: Request): Promise<Response> => {
    const result = await handler.handle(request, {
      context: { authorization: request.headers.get('authorization') },
      prefix: '/rpc',
    });

    return result.matched ? result.response : new Response('not found', { status: 404 });
  };

  const app: { handle: (request: Request) => Promise<Response> } = { handle: handleRequest };

  return { app, contract };
}

test('it sends the token as a bearer authorization header', async () => {
  const ctx = setupTest();
  const client = buildRPCTestClient<typeof ctx.contract>(ctx.app, { token: 'test-token' });

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBe('Bearer test-token');
});

test('it lets an explicit header override the token-derived authorization header', async () => {
  const ctx = setupTest();

  const client = buildRPCTestClient<typeof ctx.contract>(ctx.app, {
    headers: { authorization: 'Bearer explicit-header' },
    token: 'test-token',
  });

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBe('Bearer explicit-header');
});

test('it sends no authorization header when no token is given', async () => {
  const ctx = setupTest();
  const client = buildRPCTestClient<typeof ctx.contract>(ctx.app);

  const result = await client.echoAuthorization({});

  expect(result.authorization).toBeNull();
});
