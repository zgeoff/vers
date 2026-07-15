import { expect, test } from 'bun:test';
import { waitFor } from './wait-for';

test('it resolves with the value once the attempt stops throwing', async () => {
  let calls = 0;

  const value = await waitFor(
    () => {
      calls += 1;

      if (calls < 3) {
        throw new Error('not yet');
      }

      return 'ready';
    },
    { intervalMs: 1, timeoutMs: 500 },
  );

  expect(value).toBe('ready');
  expect(calls).toBe(3);
});

test('it retries expect-style assertions in the attempt', async () => {
  let observed = 0;

  await waitFor(
    () => {
      observed += 1;

      expect(observed).toBeGreaterThan(2);
    },
    { intervalMs: 1, timeoutMs: 500 },
  );

  expect(observed).toBe(3);
});

test('it never sleeps for an attempt that already passes', async () => {
  const before = Date.now();

  await waitFor(() => true, { intervalMs: 50, timeoutMs: 500 });

  expect(Date.now() - before).toBeLessThan(50);
});

test('it supports an async attempt', async () => {
  let calls = 0;

  const value = await waitFor(
    async () => {
      await Bun.sleep(1);

      calls += 1;

      if (calls < 2) {
        throw new Error('not yet');
      }

      return calls;
    },
    { intervalMs: 1, timeoutMs: 500 },
  );

  expect(value).toBe(2);
});

test('it rethrows the last failure when the deadline passes', () => {
  expect(
    waitFor(
      () => {
        throw new Error('still failing');
      },
      { intervalMs: 1, timeoutMs: 10 },
    ),
  ).rejects.toThrow('still failing');
});
