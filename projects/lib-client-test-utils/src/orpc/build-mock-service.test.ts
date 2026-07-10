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

const widgetContract = {
  getWidget: oc
    .route({ method: 'GET', path: '/widgets/{id}' })
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }).nullable()),
};

const widgetSchema = z.object({ id: z.string(), name: z.string() });

/**
 * A fresh, per-test in-memory backend the mocked `getWidget` handler reads from.
 */
function buildWidgetCollection() {
  return new Collection({ schema: widgetSchema });
}

type WidgetCollection = ReturnType<typeof buildWidgetCollection>;

function findWidget(widgets: WidgetCollection, id: string) {
  const widget = widgets.findFirst((query) => query.where({ id }));

  return widget ?? null;
}

test('it serves a stateful value from an @msw/data-backed router', async () => {
  const widgets = buildWidgetCollection();

  await widgets.create({ id: 'widget_1', name: 'Lantern' });

  const getWidget = implement(widgetContract).getWidget.handler((opts) =>
    findWidget(widgets, opts.input.id),
  );

  const handlers = buildMockService({
    baseUrl: 'http://widget.test',
    contract: widgetContract,
    resolveContext: () => ({}),
    router: { getWidget },
  });

  server.use(...handlers);

  const link = new RPCLink<Record<never, never>>({ url: 'http://widget.test/rpc' });

  const client: ContractRouterClient<typeof widgetContract> = createORPCClient(link);

  const result = await client.getWidget({ id: 'widget_1' });

  expect(result).toStrictEqual({ id: 'widget_1', name: 'Lantern' });
});

test('it 404s a call the router does not implement', async () => {
  const getWidget = implement(widgetContract).getWidget.handler(() => null);

  const handlers = buildMockService({
    baseUrl: 'http://widget.test',
    contract: widgetContract,
    resolveContext: () => ({}),
    router: { getWidget },
  });

  server.use(...handlers);

  const response = await fetch('http://widget.test/rpc/nonexistentProcedure', { method: 'POST' });

  expect(response.status).toBe(404);
});
