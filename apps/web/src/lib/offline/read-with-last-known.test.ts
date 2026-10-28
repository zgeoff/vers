import { expect, mock, onTestFinished, test } from 'bun:test';
import { onlineManager } from '@tanstack/react-query';
import { isRedirect, redirect } from '@tanstack/react-router';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/node';
import { buildQueryClient } from '../query/build-query-client';
import { NetworkFailureError } from './network-failure-error';
import { readServerFnResponse } from './read-server-fn-response';
import { readWithLastKnown } from './read-with-last-known';

function setupTest() {
  const queryClient = buildQueryClient();
  const flagsURL = 'http://app.test/_serverFn/flags';

  const readFlags = async () => {
    const response = await readServerFnResponse(flagsURL);

    return response.text();
  };

  return { flagsURL, queryClient, readFlags };
}

test('it reads the server again on each call while the network answers', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('market-off')));

  await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('market-on')));

  const flags = await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  expect(flags).toBe('market-on');
});

test('it answers with the last-known value, in one attempt, when the network fails', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('market-on')));

  await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  const resolver = mock(() => HttpResponse.error());

  server.use(http.get(ctx.flagsURL, resolver));

  const flags = await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  expect(flags).toBe('market-on');
  expect(resolver).toHaveBeenCalledOnce();
});

test('it answers with the last-known value while the browser reports offline', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('market-on')));

  await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  onlineManager.setOnline(false);

  onTestFinished(() => {
    onlineManager.setOnline(true);
  });

  server.use(http.get(ctx.flagsURL, () => HttpResponse.error()));

  const flags = await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  expect(flags).toBe('market-on');
});

test('it keeps the last-known value past the idle time after which Query collects a query', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('market-on')));

  await readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags);

  expect(ctx.queryClient.getQueryCache().find({ queryKey: ['last-known', 'flags'] })?.gcTime).toBe(
    Number.POSITIVE_INFINITY,
  );
});

test('it rethrows the network failure when no value is known yet', () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.error()));

  expect(readWithLastKnown(ctx.queryClient, 'flags', ctx.readFlags)).rejects.toBeInstanceOf(
    NetworkFailureError,
  );
});

test('it rethrows a redirect even when a value is known', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('signed-in')));

  await readWithLastKnown(ctx.queryClient, 'auth', ctx.readFlags);

  const outcome = await readWithLastKnown(ctx.queryClient, 'auth', () => {
    throw redirect({ href: '/login' });
  }).then(
    () => null,
    (error: unknown) => error,
  );

  expect(isRedirect(outcome)).toBe(true);
});

test('it rethrows a server fault even when a value is known', async () => {
  const ctx = setupTest();

  server.use(http.get(ctx.flagsURL, () => HttpResponse.text('signed-in')));

  await readWithLastKnown(ctx.queryClient, 'auth', ctx.readFlags);

  expect(
    readWithLastKnown(ctx.queryClient, 'auth', () =>
      Promise.reject(new Error('session lookup failed')),
    ),
  ).rejects.toThrowWithMessage(Error, 'session lookup failed');
});
