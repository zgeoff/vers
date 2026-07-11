import { expect, test } from 'bun:test';
import { withMiddleware } from './middleware';

test('it runs middleware outermost-first around the terminal handler', async () => {
  const calls: Array<string> = [];

  const handler = withMiddleware(
    [
      async (_request, next) => {
        calls.push('first:before');

        const response = await next();

        calls.push('first:after');

        return response;
      },
      async (_request, next) => {
        calls.push('second:before');

        const response = await next();

        calls.push('second:after');

        return response;
      },
    ],
    () => {
      calls.push('handler');

      return new Response('ok');
    },
  );

  await handler(new Request('https://example.test/'));

  expect(calls).toStrictEqual([
    'first:before',
    'second:before',
    'handler',
    'second:after',
    'first:after',
  ]);
});

test('it lets a middleware short-circuit the chain without calling next', async () => {
  const handler = withMiddleware(
    [() => Promise.resolve(new Response('short-circuited', { status: 418 }))],
    () => new Response('unreachable'),
  );

  const response = await handler(new Request('https://example.test/'));

  expect(response.status).toBe(418);
  expect(response.text()).resolves.toBe('short-circuited');
});

test('it falls through to the terminal handler when no middleware is given', async () => {
  const handler = withMiddleware([], () => Response.json({ ok: true }));

  const response = await handler(new Request('https://example.test/'));

  expect(response.json()).resolves.toStrictEqual({ ok: true });
});
