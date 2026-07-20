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

  const first = withLifecycleTurn(context, 'start', async () => {
    order.push('first:enter');

    await firstGate;

    order.push('first:exit');
  });

  const second = withLifecycleTurn(context, 'start', () => {
    order.push('second:enter');

    return Promise.resolve();
  });

  releaseFirst?.();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first:enter', 'first:exit', 'second:enter']);
});

test('it serializes turns of different kinds on the one mailbox', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  const order: Array<string> = [];
  let releaseStart: (() => void) | undefined;

  const startGate = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });

  const start = withLifecycleTurn(context, 'start', async () => {
    order.push('start:enter');

    await startGate;

    order.push('start:exit');
  });

  const resync = withLifecycleTurn(context, 'resync', () => {
    order.push('resync:enter');

    return Promise.resolve();
  });

  const continuation = withLifecycleTurn(context, 'continuation', () => {
    order.push('continuation:enter');

    return Promise.resolve();
  });

  releaseStart?.();

  await Promise.all([start, resync, continuation]);

  expect(order).toStrictEqual(['start:enter', 'start:exit', 'resync:enter', 'continuation:enter']);
});

test('it keeps the queue alive past a turn that throws', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  await expect(
    withLifecycleTurn(context, 'start', () => Promise.reject(new Error('turn exploded'))),
  ).toResolve();

  let ran = false;

  await withLifecycleTurn(context, 'start', () => {
    ran = true;

    return Promise.resolve();
  });

  expect(ran).toBeTrue();
});

test('it resolves the caller only once its own turn settles', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });
  let settled = false;

  await withLifecycleTurn(context, 'start', async () => {
    await Promise.resolve();

    settled = true;
  });

  expect(settled).toBeTrue();
});
