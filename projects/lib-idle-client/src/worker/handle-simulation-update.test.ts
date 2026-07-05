import { createSimulation } from '@vers/idle-core';
import { afterEach, expect, test, vi } from 'vitest';
import xxhash from 'xxhash-wasm';
import { WorkerMessageType } from '../types';
import { connections } from './connections';
import { handleSimulationUpdate } from './handle-simulation-update';
import { setSimulation } from './simulation';

const hasher = await xxhash();

afterEach(() => {
  setSimulation(null);

  connections.clear();
});

test('it sends simulation update messages to all connections', () => {
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

  const simulation = createSimulation(hasher);

  setSimulation(simulation);

  handleSimulationUpdate();

  expect(postMessageSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      state: simulation.getAppState(),
      type: WorkerMessageType.SimulationUpdate,
    }),
  );
});
