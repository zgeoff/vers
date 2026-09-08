import { expect, onTestFinished, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { registerQADebugHook } from './register-qa-debug-hook';

test('it installs a snapshot function that merges the tab identity onto the worker answer', async () => {
  const client = createStubWorkerClient();
  const unregister = registerQADebugHook({ client, tabID: 'tab_1', writerGeneration: 2 });

  onTestFinished(unregister);

  const snapshot = await globalThis.__versQA?.snapshot();

  expect(client.readDebugSnapshot).toHaveBeenCalledExactlyOnceWith({});
  expect(snapshot).toMatchObject({ phase: 'idle', tab: { tabID: 'tab_1', writerGeneration: 2 } });
  expect(snapshot).toBeFrozen();
});

test('it freezes the tab record on the snapshot', async () => {
  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    tabID: 'tab_1',
    writerGeneration: 2,
  });

  onTestFinished(unregister);

  const snapshot = await globalThis.__versQA?.snapshot();

  invariant(snapshot, 'the hook is installed');

  expect(snapshot.tab).toBeFrozen();
});

test('it removes the global on unregister', () => {
  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  unregister();

  expect('__versQA' in globalThis).toBeFalse();
});

test('it leaves a newer registration in place when an older one unregisters', () => {
  const first = registerQADebugHook({
    client: createStubWorkerClient(),
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  const second = registerQADebugHook({
    client: createStubWorkerClient(),
    tabID: 'tab_1',
    writerGeneration: 1,
  });

  onTestFinished(second);
  first();

  expect(globalThis.__versQA).toBeDefined();
});
