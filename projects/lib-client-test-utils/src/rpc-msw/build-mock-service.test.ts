import { afterAll, afterEach, expect, test } from 'bun:test';
import { factory, primaryKey } from '@mswjs/data';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import { setupServer } from 'msw/node';
import * as z from 'zod';
import { buildMockService } from './build-mock-service';

const widgetContract = {
  getWidget: oc
    .route({ method: 'GET', path: '/widgets/{id}' })
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }).nullable()),
};

/** A fresh, per-test in-memory backend the mocked `getWidget` handler reads from. */
function buildWidgetDB() {
  return factory({
    widget: {
      id: primaryKey(String),
      name: String,
    },
  });
}

type WidgetDB = ReturnType<typeof buildWidgetDB>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- @mswjs/data's factory type isn't declared readonly
function findWidget(db: WidgetDB, id: string) {
  const widget = db.widget.findFirst({ where: { id: { equals: id } } });

  return widget ?? null;
}

const server = setupServer();

server.listen({ onUnhandledRequest: 'error' });

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

test('it serves a stateful value from an @mswjs/data-backed router', async () => {
  const db = buildWidgetDB();

  db.widget.create({ id: 'widget_1', name: 'Lantern' });

  const getWidget = implement(widgetContract).getWidget.handler((opts) =>
    findWidget(db, opts.input.id),
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
