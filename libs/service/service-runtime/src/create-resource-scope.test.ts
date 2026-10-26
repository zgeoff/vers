import { expect, test } from 'bun:test';
import { createResourceScope } from './create-resource-scope';

test('it returns the adopted value unchanged', () => {
  const scope = createResourceScope();
  const pool = { name: 'pool' };

  expect(scope.adopt(pool, () => {})).toBe(pool);
});

test('it disposes the adopted resources in reverse order of adoption', async () => {
  const scope = createResourceScope();
  const stopped: Array<string> = [];

  scope.adopt('pool', (name) => {
    stopped.push(name);
  });

  scope.adopt('queue', (name) => {
    stopped.push(name);
  });

  await scope.dispose();

  expect(stopped).toStrictEqual(['queue', 'pool']);
});

test('it disposes every resource when one fails, then rejects with each failure', async () => {
  const scope = createResourceScope();
  const stopped: Array<string> = [];

  scope.adopt('pool', (name) => {
    stopped.push(name);
  });

  scope.adopt('queue', () => Promise.reject(new Error('queue stop timed out')));

  const failure = await scope.dispose().then(
    () => null,
    (error: unknown) => error,
  );

  expect(stopped).toStrictEqual(['pool']);
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure).toMatchObject({ errors: [new Error('queue stop timed out')] });
});

test('it disposes each resource once when disposed twice', async () => {
  const scope = createResourceScope();
  const stopped: Array<string> = [];

  scope.adopt('pool', (name) => {
    stopped.push(name);
  });

  await scope.dispose();
  await scope.dispose();

  expect(stopped).toStrictEqual(['pool']);
});
