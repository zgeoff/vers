import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { renderWithRouter } from '../../test-utils/render-with-router';
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
