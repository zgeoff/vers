import { expect, mock, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createStubWorkerContext } from './create-stub-worker-context';

test('it creates a context with no connections and an empty simulation by default', () => {
  const context = createStubWorkerContext();

  expect(context.connections.size).toBe(0);
  expect(context.getSimulation().activity).toBeNull();
});

test('it seeds the connections set from the given ports', () => {
  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port1] });

  expect(context.connections.has(channel.port1)).toBeTrue();
});

test('it stores and returns the simulation set on it', () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  expect(context.getSimulation()).toBe(simulation);
});

test('it drops a port from the connections set', () => {
  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port1] });

  context.removeConnection(channel.port1);

  expect(context.connections.has(channel.port1)).toBeFalse();
});

test('it returns the injected submitter', () => {
  const submitter: CheckpointSubmitter = {
    flushHeld: mock(() => Promise.resolve()),
    flushNow: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve(undefined)),
    isEvicted: mock(() => false),
    removeEviction: mock(() => {}),
  };

  const context = createStubWorkerContext({ submitter });

  expect(context.getSubmitter()).toBe(submitter);
});
