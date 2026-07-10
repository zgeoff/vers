import { expect, onTestFinished, test } from 'bun:test';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import type {
  DisconnectMessage,
  InitializeMessage,
  SetActivityMessage,
  WorkerMessage,
} from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerRuntime's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
function createConnection(runtime: WorkerRuntime): MessagePort {
  const channel = new MessageChannel();

  runtime.handleConnect(new MessageEvent('connect', { ports: [channel.port2] }));

  channel.port1.start();

  return channel.port1;
}

function waitForMessage(port: MessagePort) {
  return new Promise<MessageEvent<WorkerMessage>>((resolve) => {
    port.addEventListener('message', resolve, { once: true });
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerRuntime's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
async function waitForConnectionCount(runtime: WorkerRuntime, size: number) {
  for (let attempt = 0; attempt < 50 && runtime.connections.size !== size; attempt++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  }
}

test('it sends the initial state', async () => {
  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const port = createConnection(runtime);
  const reply = waitForMessage(port);

  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  port.postMessage(message);

  const event = await reply;

  expect(event.data.type).toBe(WorkerMessageType.InitialState);
});

test('it processes simulation updates', async () => {
  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const port = createConnection(runtime);

  const initializeMessage: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const initialized = waitForMessage(port);

  port.postMessage(initializeMessage);

  await initialized;

  const setActivityMessage: SetActivityMessage = {
    activity: createMockActivityData(),
    avatar: createMockAvatarData(),
    type: ClientMessageType.SetActivity,
  };

  const updated = waitForMessage(port);

  port.postMessage(setActivityMessage);

  const event = await updated;

  expect(event.data.type).toBe(WorkerMessageType.SimulationUpdate);
});

test('it stops broadcasting to a connection after it disconnects', async () => {
  const runtime = createWorkerRuntime();

  onTestFinished(() => {
    runtime.stop();
  });

  const survivor = createConnection(runtime);
  const leaving = createConnection(runtime);

  const survivorInitialized = waitForMessage(survivor);

  survivor.postMessage({ type: ClientMessageType.Initialize } satisfies InitializeMessage);

  await survivorInitialized;

  expect(runtime.connections.size).toBe(2);

  leaving.postMessage({ type: ClientMessageType.Disconnect } satisfies DisconnectMessage);

  await waitForConnectionCount(runtime, 1);

  expect(runtime.connections.size).toBe(1);

  const survivorUpdated = waitForMessage(survivor);

  survivor.postMessage({
    activity: createMockActivityData(),
    avatar: createMockAvatarData(),
    type: ClientMessageType.SetActivity,
  } satisfies SetActivityMessage);

  const event = await survivorUpdated;

  expect(event.data.type).toBe(WorkerMessageType.SimulationUpdate);
});
