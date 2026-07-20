import { expect, test } from 'bun:test';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { withLifecycleTurn } from './with-lifecycle-turn';

test('it runs queued turns strictly one at a time in queue order', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const order: Array<string> = [];
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = withLifecycleTurn(context, async () => {
    order.push('first:enter');

    await firstGate;

    order.push('first:exit');
  });

  const second = withLifecycleTurn(context, async () => {
    order.push('second:enter');
  });

  releaseFirst?.();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first:enter', 'first:exit', 'second:enter']);
});

test('it keeps the queue alive past a turn that throws', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await expect(
    withLifecycleTurn(context, () => Promise.reject(new Error('turn exploded'))),
  ).toResolve();

  let ran = false;

  await withLifecycleTurn(context, async () => {
    ran = true;
  });

  expect(ran).toBeTrue();
});

test('it resolves the caller only once its own turn settles', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  let settled = false;

  await withLifecycleTurn(context, async () => {
    await Promise.resolve();

    settled = true;
  });

  expect(settled).toBeTrue();
});
