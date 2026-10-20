import { expect, test } from 'bun:test';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import * as z from 'zod';
import type { ConformanceCaseApp } from './collect-conformance-cases';
import { collectConformanceCases } from './collect-conformance-cases';

function setupTest() {
  const contract = {
    getThing: oc
      .errors({
        UNAUTHORIZED: {
          data: z.object({ reason: z.string() }),
          message: 'No valid session',
        },
      })
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: oc.output(z.object({ pong: z.boolean() })),
  };

  const os = implement(contract).$context<{ actingUserID: null | string }>();

  return { contract, os };
}

test('it collects titles covering malformed-input, anonymous-UNAUTHORIZED, and openapi generation', () => {
  const ctx = setupTest();

  const cases = collectConformanceCases(ctx.contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });

  const titles = cases.map((conformanceCase) => conformanceCase.title);

  expect(titles).toSatisfyAll((title: string) => title.startsWith('it '));
  expect(titles).toContain('it rejects malformed input on getThing');
  expect(titles).toContain('it rejects an anonymous call to getThing with UNAUTHORIZED');
  expect(titles).toContain('it generates an OpenAPI document from the contract');
  expect(titles).not.toContain('it rejects malformed input on ping');
});

test('it passes every collected case against a conforming app', async () => {
  const ctx = setupTest();

  const handler = new RPCHandler({
    getThing: ctx.os.getThing.handler((opts) => {
      if (opts.context.actingUserID === null) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return { id: opts.input.id };
    }),
    ping: ctx.os.ping.handler(() => ({ pong: true })),
  });

  const app: ConformanceCaseApp = {
    handle: async (request) => {
      const result = await handler.handle(request, {
        context: {
          actingUserID: request.headers.get('x-acting-user-id'),
        },
        prefix: '/rpc',
      });

      return result.matched ? result.response : new Response('not found', { status: 404 });
    },
  };

  const cases = collectConformanceCases(ctx.contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(app)).toResolve();
  }
});

test('it fails the anonymous-UNAUTHORIZED case against a nonconforming app', async () => {
  const ctx = setupTest();

  const handler = new RPCHandler({
    getThing: ctx.os.getThing.handler((opts) => ({ id: opts.input.id })),
    ping: ctx.os.ping.handler(() => ({ pong: true })),
  });

  const app: ConformanceCaseApp = {
    handle: async (request) => {
      const result = await handler.handle(request, {
        context: {
          actingUserID: request.headers.get('x-acting-user-id'),
        },
        prefix: '/rpc',
      });

      return result.matched ? result.response : new Response('not found', { status: 404 });
    },
  };

  const cases = collectConformanceCases(ctx.contract, {
    anonymousHeaders: {},
    authedSamples: { getThing: { id: 'sample-id' } },
  });

  const anonymousCase = cases.find((conformanceCase) =>
    conformanceCase.title.includes('UNAUTHORIZED'),
  );

  await expect(anonymousCase?.run(app)).toReject();
});
