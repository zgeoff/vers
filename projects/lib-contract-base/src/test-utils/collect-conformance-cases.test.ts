import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { Elysia } from 'elysia';
import { expect, test } from 'vitest';
import * as z from 'zod';
import { authedRoute } from '../authed-route';
import { publicRoute } from '../public-route';
import type { ConformanceCaseApp } from './collect-conformance-cases';
import { collectConformanceCases } from './collect-conformance-cases';

test('it collects titles covering malformed-input, anonymous-UNAUTHORIZED, and openapi generation', () => {
  const contract = buildTestContract();

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });
  const titles = cases.map((c) => c.title);

  expect(titles).toSatisfyAll((title: string) => title.startsWith('it '));
  expect(titles).toInclude('it rejects malformed input on getThing');
  expect(titles).toInclude('it rejects an anonymous call to getThing with UNAUTHORIZED');
  expect(titles).toInclude('it generates an OpenAPI document from the contract');
  expect(titles).not.toInclude('it rejects malformed input on ping');
});

test('it passes every collected case against a conforming app', async () => {
  const contract = buildTestContract();
  const app = buildConformingApp(contract);

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });

  for (const c of cases) {
    await expect(c.run(app)).toResolve();
  }
});

test('it fails the anonymous-UNAUTHORIZED case against a nonconforming app', async () => {
  const contract = buildTestContract();
  const app = buildBrokenApp(contract);

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });
  const anonymousCase = cases.find((c) => c.title.includes('UNAUTHORIZED'));

  await expect(anonymousCase?.run(app)).toReject();
});

function buildTestContract() {
  return {
    getThing: authedRoute.input(z.object({ id: z.string() })).output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
  };
}

type TestContract = ReturnType<typeof buildTestContract>;

/** Builds an app whose getThing handler enforces the acting-user check the contract declares. */
function buildConformingApp(contract: TestContract): ConformanceCaseApp {
  const os = implement(contract).$context<{ actingUserId: null | string }>();
  const router = {
    getThing: os.getThing.handler((opts) => {
      if (opts.context.actingUserId === null) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return { id: opts.input.id };
    }),
    ping: os.ping.handler(() => ({ pong: true })),
  };

  return buildRPCApp(new RPCHandler(router));
}

/** Builds an app whose getThing handler skips the acting-user check, so anonymous calls succeed. */
function buildBrokenApp(contract: TestContract): ConformanceCaseApp {
  const os = implement(contract).$context<{ actingUserId: null | string }>();
  const router = {
    getThing: os.getThing.handler((opts) => ({ id: opts.input.id })),
    ping: os.ping.handler(() => ({ pong: true })),
  };

  return buildRPCApp(new RPCHandler(router));
}

function buildRPCApp(handler: RPCHandler<{ actingUserId: null | string }>): ConformanceCaseApp {
  return new Elysia().all('/rpc*', async (context) => {
    const result = await handler.handle(context.request, {
      context: {
        actingUserId: context.request.headers.get('x-acting-user-id'),
      },
      prefix: '/rpc',
    });

    return result.matched ? result.response : new Response('not found', { status: 404 });
  });
}
