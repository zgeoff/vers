import { expect, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { runOnLifecycleChain } from './run-on-lifecycle-chain';

test('it runs queued flows strictly one at a time, in arrival order', async () => {
  const context = createStubWorkerContext();
  const order: Array<string> = [];
  const gate = Promise.withResolvers<void>();

  const first = runOnLifecycleChain(context, 'start', async () => {
    order.push('first-entered');

    await gate.promise;

    order.push('first-settled');
  });

  const second = runOnLifecycleChain(context, 'start', () => {
    order.push('second-entered');

    return Promise.resolve();
  });

  await waitFor(() => {
    expect(order).toContain('first-entered');
  });

  expect(order).toStrictEqual(['first-entered']);

  gate.resolve();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first-entered', 'first-settled', 'second-entered']);
});

test('it settles a throwing flow without stranding the next', async () => {
  const context = createStubWorkerContext();
  const order: Array<string> = [];

  await runOnLifecycleChain(context, 'start', async () => {
    await Promise.resolve();

    throw new Error('first flow dies');
  });

  await runOnLifecycleChain(context, 'start', () => {
    order.push('second-ran');

    return Promise.resolve();
  });

  expect(order).toStrictEqual(['second-ran']);
});
