import { expect, test } from 'vitest';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { Elysia } from 'elysia';
import * as z from 'zod';
import { authedRoute } from '../authed-route';
import { publicRoute } from '../public-route';
import { collectConformanceCases } from './collect-conformance-cases';

test('it collects titles covering malformed-input, anonymous-UNAUTHORIZED, and openapi generation', () => {
  const contract = {
    getThing: authedRoute
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
  };

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });
  const titles = cases.map((c) => c.title);

  expect(titles).toSatisfyAll((title: string) => title.startsWith('it '));
  expect(titles).toInclude('it rejects malformed input on getThing');
  expect(titles).toInclude(
    'it rejects an anonymous call to getThing with UNAUTHORIZED',
  );
  expect(titles).toInclude(
    'it generates an OpenAPI document from the contract',
  );
  expect(titles).not.toInclude('it rejects malformed input on ping');
});

test('it passes every collected case against a conforming app', async () => {
  const contract = {
    getThing: authedRoute
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
  };
  const os = implement(contract).$context<{ actingUserId: null | string }>();
  const router = {
    getThing: os.getThing.handler(({ context, errors, input }) => {
      if (context.actingUserId === null) {
        throw errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return { id: input.id };
    }),
    ping: os.ping.handler(() => ({ pong: true })),
  };
  const handler = new RPCHandler(router);
  const app = new Elysia().all('/rpc*', async ({ request }) => {
    const { matched, response } = await handler.handle(request, {
      context: { actingUserId: request.headers.get('x-acting-user-id') },
      prefix: '/rpc',
    });

    return matched ? response : new Response('not found', { status: 404 });
  });

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });

  for (const c of cases) {
    await expect(c.run(app)).toResolve();
  }
});

test('it fails the anonymous-UNAUTHORIZED case against a nonconforming app', async () => {
  const contract = {
    getThing: authedRoute
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
  };
  const os = implement(contract).$context<{ actingUserId: null | string }>();
  const brokenRouter = {
    getThing: os.getThing.handler(({ input }) => ({ id: input.id })),
    ping: os.ping.handler(() => ({ pong: true })),
  };
  const handler = new RPCHandler(brokenRouter);
  const app = new Elysia().all('/rpc*', async ({ request }) => {
    const { matched, response } = await handler.handle(request, {
      context: { actingUserId: request.headers.get('x-acting-user-id') },
      prefix: '/rpc',
    });

    return matched ? response : new Response('not found', { status: 404 });
  });

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });
  const anonymousCase = cases.find((c) => c.title.includes('UNAUTHORIZED'));

  await expect(anonymousCase?.run(app)).toReject();
});
