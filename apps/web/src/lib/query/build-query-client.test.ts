import { expect, onTestFinished, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import { QueryClient } from '@tanstack/react-query';
import { buildQueryClient } from './build-query-client';

test('it builds a query client when BroadcastChannel is absent (the SSR path)', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  Reflect.deleteProperty(globalThis, 'BroadcastChannel');

  onTestFinished(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  expect(buildQueryClient()).toBeInstanceOf(QueryClient);
});

test('it opens no broadcast channel when there is no window, even with BroadcastChannel present', () => {
  const originalWindow = globalThis.window;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  let constructed = 0;

  globalThis.BroadcastChannel = class extends originalBroadcastChannel {
    constructor(name: string) {
      super(name);

      constructed += 1;
    }
  };

  Reflect.deleteProperty(globalThis, 'window');

  onTestFinished(() => {
    globalThis.window = originalWindow;
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  expect(buildQueryClient()).toBeInstanceOf(QueryClient);
  expect(constructed).toBe(0);
});

test('it does not retry a 4xx service error', async () => {
  const queryClient = buildQueryClient();
  let attempts = 0;

  const result = queryClient.fetchQuery({
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

  const result = queryClient.fetchQuery({
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

  const result = queryClient.fetchQuery({
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
