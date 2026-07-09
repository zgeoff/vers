import { expect, mock, test } from 'bun:test';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { RemoteAddressEnv } from './remote-address-middleware';
import { remoteAddressMiddleware } from './remote-address-middleware';

const testHandlerSpy = mock<(ctx: Context<RemoteAddressEnv>) => Promise<Response>>((ctx) =>
  Promise.resolve(ctx.json({ ipAddress: ctx.get('ipAddress') })),
);

function setupTest() {
  const app = new Hono();

  app.use('/test', remoteAddressMiddleware, testHandlerSpy);

  return { app };
}

test('it sets the ip address from the fly header', async () => {
  const ctx = setupTest();

  const req = new Request('http://localhost/test');

  req.headers.set('fly-client-ip', '127.0.0.1');

  const res = await ctx.app.request(req);

  expect(res.json()).resolves.toStrictEqual({
    ipAddress: '127.0.0.1',
  });
});

test('it sets the ip address from the x-forwarded-for header', async () => {
  const ctx = setupTest();

  const req = new Request('http://localhost/test');

  req.headers.set('x-forwarded-for', '127.0.0.1, 127.0.0.2');

  const res = await ctx.app.request(req);

  expect(res.json()).resolves.toStrictEqual({
    ipAddress: '127.0.0.1',
  });
});
