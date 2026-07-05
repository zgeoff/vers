import type { Context } from 'hono';
import { Hono } from 'hono';
import { expect, test, vi } from 'vitest';
import { remoteAddressMiddleware } from './remote-address-middleware';

const testHandlerSpy = vi.fn<(ctx: Context) => Promise<Response>>((ctx: Context) =>
  Promise.resolve(ctx.json({ ipAddress: ctx.get('ipAddress') })),
);

function setupTest() {
  const app = new Hono();

  app.use('/test', remoteAddressMiddleware, testHandlerSpy);

  return { app };
}

test('it sets the ip address from the fly header', async () => {
  const { app } = setupTest();

  const req = new Request('http://localhost/test');

  req.headers.set('fly-client-ip', '127.0.0.1');

  const res = await app.request(req);

  await expect(res.json()).resolves.toStrictEqual({
    ipAddress: '127.0.0.1',
  });
});

test('it sets the ip address from the x-forwarded-for header', async () => {
  const { app } = setupTest();

  const req = new Request('http://localhost/test');

  req.headers.set('x-forwarded-for', '127.0.0.1, 127.0.0.2');

  const res = await app.request(req);

  await expect(res.json()).resolves.toStrictEqual({
    ipAddress: '127.0.0.1',
  });
});
