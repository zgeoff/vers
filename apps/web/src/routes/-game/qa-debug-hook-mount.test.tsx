import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { QADebugHookMount } from './qa-debug-hook-mount';

test('it installs the hook for a QA account once a worker is connected, and removes it on unmount', async () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const rendered = render(<QADebugHookMount qaAccount />);

  const snapshot = await globalThis.__versQA?.snapshot();

  expect(snapshot).toMatchObject({ phase: 'idle', tab: { writerGeneration: 0 } });
  expect(snapshot?.tab.tabID).toBeString();

  rendered.unmount();

  expect('__versQA' in globalThis).toBeFalse();
});

test('it installs nothing for an account outside the QA domain', () => {
  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  render(<QADebugHookMount qaAccount={false} />);

  expect('__versQA' in globalThis).toBeFalse();
});

test('it installs nothing before a worker has connected', () => {
  setIdleWorkerHandle({
    activity: undefined,
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal: new AbortController().signal,
  });

  render(<QADebugHookMount qaAccount />);

  expect('__versQA' in globalThis).toBeFalse();
});
