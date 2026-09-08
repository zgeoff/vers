import { expect, onTestFinished, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { registerQADebugHook } from './register-qa-debug-hook';

test('it installs a snapshot function that merges the tab identity onto the worker answer', async () => {
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 2,
  });

  onTestFinished(unregister);

  const snapshot = await globalThis.__versQA?.snapshot();

  expect(client.readDebugSnapshot).toHaveBeenCalledExactlyOnceWith({});
  expect(snapshot).toMatchObject({ phase: 'idle', tab: { tabID: 'tab_1', writerGeneration: 2 } });
  expect(snapshot).toBeFrozen();
});

test('it freezes the tab record on the snapshot', async () => {
  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
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
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  unregister();

  expect('__versQA' in globalThis).toBeFalse();
});

test('it leaves a newer registration in place when an older one unregisters', () => {
  const first = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  const second = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 1,
  });

  onTestFinished(second);
  first();

  expect(globalThis.__versQA).toBeDefined();
});

test('it forwards a speed to the worker with the QA flag of the active avatar and answers the applied speed', async () => {
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  const applied = await globalThis.__versQA?.setSpeed(12);

  expect(applied).toBe(12);

  expect(client.setSimulationSpeed).toHaveBeenCalledExactlyOnceWith({
    isQAAvatar: true,
    speed: 12,
  });
});

test('it throws when the worker refuses the speed for an avatar that is not flagged for QA', () => {
  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: false,
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  onTestFinished(unregister);
  invariant(globalThis.__versQA, 'the hook is installed');

  expect(globalThis.__versQA.setSpeed(2)).rejects.toThrowWithMessage(Error, /not flagged for QA/);
});

test('it rejects a speed outside 1 to 20 before asking the worker', () => {
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    tabID: 'tab_1',
    writerGeneration: 0,
  });

  onTestFinished(unregister);
  invariant(globalThis.__versQA, 'the hook is installed');

  expect(globalThis.__versQA.setSpeed(21)).rejects.toThrowWithMessage(RangeError, /1 to 20/);
  expect(globalThis.__versQA.setSpeed(1.5)).rejects.toThrowWithMessage(RangeError, /integer/);
  expect(client.setSimulationSpeed).not.toHaveBeenCalled();
});
