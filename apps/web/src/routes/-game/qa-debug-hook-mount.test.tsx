import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import type { WorkerDebugSnapshot } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { QA_RECORD_KEYS } from '../../lib/qa/qa-record-keys';
import { readRefusalCaptures } from '../../lib/qa/read-refusal-captures';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
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

  const rendered = renderWithRouter(<QADebugHookMount qaAccount />);

  await waitFor(() => {
    expect(globalThis.__versQA).toBeDefined();
  });

  const snapshot = await globalThis.__versQA?.snapshot();

  expect(snapshot).toMatchObject({ phase: 'idle', tab: { writerGeneration: 0 } });
  expect(snapshot?.tab.tabID).toBeString();

  rendered.unmount();

  expect('__versQA' in globalThis).toBeFalse();
});

test('it keeps a refusal capture through a remount and completes it when the first worker read answers', async () => {
  const sender = new BroadcastChannel('vers-idle-worker-to-client');

  onTestFinished(() => {
    sender.close();
    sessionStorage.removeItem(QA_RECORD_KEYS.receivedOutcomes);

    for (const entry of readRefusalCaptures(localStorage)) {
      localStorage.removeItem(entry.key);
    }
  });

  const captureRead = Promise.withResolvers<WorkerDebugSnapshot>();

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient({ readDebugSnapshot: () => captureRead.promise }),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const first = renderWithRouter(<QADebugHookMount qaAccount />);

  await waitFor(() => {
    expect(globalThis.__versQA).toBeDefined();
  });

  sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(readRefusalCaptures(localStorage).map((entry) => entry.capture.status)).toStrictEqual([
      'pending',
    ]);
  });

  first.unmount();

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  renderWithRouter(<QADebugHookMount qaAccount />);

  await waitFor(() => {
    expect(globalThis.__versQA).toBeDefined();
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const pendingSnapshot = globalThis.__versQA.snapshot();

  captureRead.reject(new Error('the worker answered late'));

  const snapshot = await pendingSnapshot;

  expect(snapshot.refusalCaptures).toStrictEqual([
    expect.objectContaining({
      status: 'complete',
      trigger: expect.objectContaining({ workerID: 'worker_1' }),
      workerError: 'Error: the worker answered late',
    }),
  ]);
});

test('it installs the hook and reports the failure when a browser policy blocks storage', async () => {
  const localStorageProperty = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  invariant(localStorageProperty, 'the test window has local storage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new DOMException('the origin may not use storage', 'SecurityError');
    },
  });

  onTestFinished(() => {
    Object.defineProperty(globalThis, 'localStorage', localStorageProperty);
  });

  const sender = new BroadcastChannel('vers-idle-worker-to-client');

  onTestFinished(() => {
    sender.close();
    sessionStorage.removeItem(QA_RECORD_KEYS.receivedOutcomes);
  });

  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  renderWithRouter(<QADebugHookMount qaAccount />);

  await waitFor(() => {
    expect(globalThis.__versQA).toBeDefined();
  });

  sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const hook = globalThis.__versQA;

  await waitFor(async () => {
    const snapshot = await hook.snapshot();

    expect(snapshot.captureFailures).toContain('SecurityError: the origin may not use storage');
  });
});

test('it installs nothing for an account outside the QA domain', async () => {
  setIdleWorkerHandle({
    activity: undefined,
    client: createStubWorkerClient(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  const rendered = renderWithRouter(<QADebugHookMount qaAccount={false} />);

  await waitFor(() => {
    expect(rendered.router.state.status).toBe('idle');
    expect(rendered.router.state.matches.length).toBeGreaterThan(0);
  });

  expect('__versQA' in globalThis).toBeFalse();
});

test('it installs nothing before a worker has connected', async () => {
  setIdleWorkerHandle({
    activity: undefined,
    client: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: false,
    writerAbortSignal: new AbortController().signal,
  });

  const rendered = renderWithRouter(<QADebugHookMount qaAccount />);

  await waitFor(() => {
    expect(rendered.router.state.status).toBe('idle');
    expect(rendered.router.state.matches.length).toBeGreaterThan(0);
  });

  expect('__versQA' in globalThis).toBeFalse();
});

test('it hands the hook the QA flag of the active avatar so a speed above real time applies', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ isQA: true, userID: signedIn.userID });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<QADebugHookMount qaAccount />);

    // the hook registers before the avatar query answers and again once it does; only the second
    // registration carries the flag, so the call is retried until that registration is in place
    await waitFor(async () => {
      const applied = await globalThis.__versQA?.setSpeed(3);

      expect(applied).toBe(3);
    });

    expect(client.setSimulationSpeed).toHaveBeenLastCalledWith({ isQAAvatar: true, speed: 3 });
  });
});
