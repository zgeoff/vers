import { expect, onTestFinished, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';
import { notFound, redirect } from '@tanstack/react-router';
import { waitFor } from '@vers/test-utils';
import { NetworkFailureError } from '../offline/network-failure-error';
import { buildQueryClient } from './build-query-client';

test('it does not retry a 4xx service error', async () => {
  const queryClient = buildQueryClient();
  let attempts = 0;

  const result = queryClient.query({
    queryFn: () => {
      attempts += 1;
      throw new ORPCError('CONFLICT');
    },
    queryKey: ['conflict'],
    retryDelay: 0,
  });

  expect(result).rejects.toMatchObject({ code: 'CONFLICT' });

  await Promise.allSettled([result]);

  expect(attempts).toBe(1);
});

test('it retries a 5xx service error twice before failing', async () => {
  const queryClient = buildQueryClient();
  let attempts = 0;

  const result = queryClient.query({
    queryFn: () => {
      attempts += 1;
      throw new ORPCError('INTERNAL_SERVER_ERROR');
    },
    queryKey: ['server-fault'],
    retryDelay: 0,
  });

  expect(result).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });

  await Promise.allSettled([result]);

  expect(attempts).toBe(3);
});

test('it retries a network-style failure twice before failing', async () => {
  const queryClient = buildQueryClient();
  let attempts = 0;

  const result = queryClient.query({
    queryFn: () => {
      attempts += 1;
      throw new TypeError('fetch failed');
    },
    queryKey: ['network'],
    retryDelay: 0,
  });

  expect(result).rejects.toThrowWithMessage(TypeError, 'fetch failed');

  await Promise.allSettled([result]);

  expect(attempts).toBe(3);
});

test.each([
  ['a redirect', redirect({ href: '/login' })],
  ['a not-found', notFound()],
  ['a network failure', new NetworkFailureError({ cause: new TypeError('Failed to fetch') })],
])('it leaves %s out of the error reports', async (_label, thrown) => {
  const queryClient = buildQueryClient();
  const recorded: Array<Readonly<ErrorEvent>> = [];

  Sentry.init({
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    defaultIntegrations: false,
    dsn: 'https://testpublickey@o0.ingest.sentry.io/1',

    // the default transport probes an iframe for a native fetch, which happy-dom refuses to load
    transport: (options) => Sentry.createTransport(options, () => Promise.resolve({})),
  });

  onTestFinished(async () => {
    await Sentry.close();
  });

  await Promise.allSettled([
    queryClient.query({
      queryFn: () => Promise.reject(thrown),
      queryKey: ['outcome'],
      retry: false,
    }),
  ]);

  // a later fault's report shows the earlier failure's report would have landed first
  await Promise.allSettled([
    queryClient.query({
      queryFn: () => Promise.reject(new Error('unexpected fault')),
      queryKey: ['fault'],
      retry: false,
    }),
  ]);

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.exception?.values?.[0]).toMatchObject({ value: 'unexpected fault' });
});
