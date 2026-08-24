import { expect, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import { buildQueryClient } from './build-query-client';

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
