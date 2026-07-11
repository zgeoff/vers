import { expect, test } from 'bun:test';
import { withRetry } from './with-retry';

test('it returns the first successful result', async () => {
  let runs = 0;

  const result = await withRetry(
    () => {
      runs += 1;

      if (runs < 3) {
        return Promise.reject(new Error('not yet'));
      }

      return Promise.resolve('ok');
    },
    { attempts: 5, delayMS: 1 },
  );

  expect(result).toBe('ok');
  expect(runs).toBe(3);
});

test('it rethrows the final error once attempts are exhausted', () => {
  let runs = 0;

  const promise = withRetry(
    () => {
      runs += 1;

      return Promise.reject(new Error(`failure ${runs}`));
    },
    { attempts: 3, delayMS: 1 },
  );

  expect(promise).rejects.toThrowWithMessage(Error, 'failure 3');
});
