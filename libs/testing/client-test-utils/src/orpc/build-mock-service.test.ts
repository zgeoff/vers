import { expect, test } from 'bun:test';
import { Collection } from '@msw/data';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import * as z from 'zod';
import { buildMockService } from './build-mock-service';
import { server } from './mocks/server';

function setupTest() {
  const contract = {
    getWidget: oc
      .route({ method: 'GET', path: '/widgets/{id}' })
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string(), name: z.string() }).nullable()),
  };

  const widgets = new Collection({ schema: z.object({ id: z.string(), name: z.string() }) });

  return { contract, widgets };
}

test('it serves a stateful value from an @msw/data-backed router', async () => {
  const ctx = setupTest();

  await ctx.widgets.create({ id: 'widget_1', name: 'Lantern' });

  const getWidget = implement(ctx.contract).getWidget.handler(
    (opts) => ctx.widgets.findFirst((query) => query.where({ id: opts.input.id })) ?? null,
  );

  const handlers = buildMockService({
    baseUrl: 'http://widget.test',
    contract: ctx.contract,
    resolveContext: () => ({}),
    router: { getWidget },
  });

  server.use(...handlers);

  const link = new RPCLink<Record<string, never>>({ url: 'http://widget.test/rpc' });

  const client: ContractRouterClient<typeof ctx.contract> = createORPCClient(link);

  const result = await client.getWidget({ id: 'widget_1' });

  expect(result).toStrictEqual({ id: 'widget_1', name: 'Lantern' });
});

test('it 404s a call the router does not implement', async () => {
  const ctx = setupTest();
  const getWidget = implement(ctx.contract).getWidget.handler(() => null);

  const handlers = buildMockService({
    baseUrl: 'http://widget.test',
    contract: ctx.contract,
    resolveContext: () => ({}),
    router: { getWidget },
  });

  server.use(...handlers);

  const response = await fetch('http://widget.test/rpc/nonexistentProcedure', { method: 'POST' });

  expect(response.status).toBe(404);
});
