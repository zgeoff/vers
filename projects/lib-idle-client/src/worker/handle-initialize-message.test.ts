import { createSimulation } from '@vers/idle-core';
import { afterEach, expect, test, vi } from 'vitest';
import xxhash from 'xxhash-wasm';
import type { InitializeMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { connections } from './connections';
import { handleInitializeMessage } from './handle-initialize-message';
import { getSimulation, setSimulation } from './simulation';

const hasher = await xxhash();

afterEach(() => {
  setSimulation(null);

  connections.clear();
});

test('it initializes the simulation', async () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(message);

  const simulation = getSimulation();

  expect(simulation).not.toBeNull();
});

test('it sends an initial state message to all connections', async () => {
  const postMessageSpy = vi.fn<(message: unknown) => void>();

  const mockPort: MessagePort = {
    addEventListener: vi.fn<MessagePort['addEventListener']>(),
    close: vi.fn<MessagePort['close']>(),
    dispatchEvent: vi.fn<MessagePort['dispatchEvent']>(),
    onmessage: vi.fn<NonNullable<MessagePort['onmessage']>>(),
    onmessageerror: vi.fn<NonNullable<MessagePort['onmessageerror']>>(),
    postMessage: postMessageSpy,
    removeEventListener: vi.fn<MessagePort['removeEventListener']>(),
    start: vi.fn<MessagePort['start']>(),
  };

  connections.add(mockPort);

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(message);

  const simulation = getSimulation();

  expect(postMessageSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      state: simulation?.getAppState(),
      type: WorkerMessageType.InitialState,
    }),
  );
});

test('it does not create a new simulation if one already exists', async () => {
  const existingSimulation = createSimulation(hasher);

  setSimulation(existingSimulation);

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  await handleInitializeMessage(message);

  const simulation = getSimulation();

  expect(simulation).toBe(existingSimulation);
});
