import { expect, mock, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../../submission/create-checkpoint-submitter';
import { createMockWorkerContext } from './create-mock-worker-context';

test('it creates a context with no connections and no simulation by default', () => {
  const context = createMockWorkerContext();

  expect(context.connections.size).toBe(0);
  expect(context.getSimulation()).toBeNull();
});

test('it seeds the connections set from the given ports', () => {
  const channel = new MessageChannel();

  const context = createMockWorkerContext({ connections: [channel.port1] });

  expect(context.connections.has(channel.port1)).toBeTrue();
});

test('it stores and returns the simulation set on it', () => {
  const context = createMockWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  expect(context.getSimulation()).toBe(simulation);
});

test('it drops a port from the connections set', () => {
  const channel = new MessageChannel();

  const context = createMockWorkerContext({ connections: [channel.port1] });

  context.removeConnection(channel.port1);

  expect(context.connections.has(channel.port1)).toBeFalse();
});

test('it returns the injected submitter', () => {
  const submitter: CheckpointSubmitter = {
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve()),
  };

  const context = createMockWorkerContext({ submitter });

  expect(context.getSubmitter()).toBe(submitter);
});
