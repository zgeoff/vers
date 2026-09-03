import { expect, mock, test } from 'bun:test';
import { rejectNonHTMLAccept } from './reject-non-html-accept';

test('it answers a page request that accepts only JSON with 406', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(
    new Request('https://example.test/', { headers: { accept: 'application/json' } }),
    next,
  );

  expect(next).not.toHaveBeenCalled();
  expect(response.status).toBe(406);
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  expect(response.headers.get('vary')).toBe('accept');
  expect(response.text()).resolves.toBe('Not Acceptable: this path serves text/html');
});

test('it answers a page request whose accept list names no HTML type with 406', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(
    new Request('https://example.test/llms.txt', {
      headers: { accept: 'text/plain, application/json;q=0.9' },
    }),
    next,
  );

  expect(next).not.toHaveBeenCalled();
  expect(response.status).toBe(406);
});

test.each([['/api/rpc/user/getCurrentUser'], ['/_serverFn/abc123'], ['/health']])(
  'it passes a JSON-only request to %s through',
  async (pathname) => {
    const next = mock(() => Promise.resolve(new Response('served')));

    const response = await rejectNonHTMLAccept(
      new Request(`https://example.test${pathname}`, { headers: { accept: 'application/json' } }),
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.text()).resolves.toBe('served');
  },
);

test('it passes a request that accepts text/html through', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(
    new Request('https://example.test/account', {
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9' },
    }),
    next,
  );

  expect(next).toHaveBeenCalledOnce();
  expect(response.text()).resolves.toBe('page');
});

test('it passes a request that accepts any type through', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(
    new Request('https://example.test/account', { headers: { accept: 'text/plain, */*;q=0.1' } }),
    next,
  );

  expect(next).toHaveBeenCalledOnce();
  expect(response.text()).resolves.toBe('page');
});

test('it passes a request with no accept header through', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(new Request('https://example.test/account'), next);

  expect(next).toHaveBeenCalledOnce();
  expect(response.text()).resolves.toBe('page');
});

test('it passes a request with an empty accept header through', async () => {
  const next = mock(() => Promise.resolve(new Response('page')));

  const response = await rejectNonHTMLAccept(
    new Request('https://example.test/account', { headers: { accept: '' } }),
    next,
  );

  expect(next).toHaveBeenCalledOnce();
  expect(response.text()).resolves.toBe('page');
});
