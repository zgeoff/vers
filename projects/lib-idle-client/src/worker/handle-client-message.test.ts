import { createMockActivityData, createMockAvatarData, createSimulation } from '@vers/idle-core';
import { afterEach, expect, test } from 'vitest';
import xxhash from 'xxhash-wasm';
import type { InitializeMessage, SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { handleClientMessage } from './handle-client-message';
import { getSimulation, setSimulation } from './simulation';

const hasher = await xxhash();

afterEach(() => {
  setSimulation(null);
});

test('it handles initialization messages', async () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(event);

  const simulation = getSimulation();

  expect(simulation).not.toBeNull();
});

test('it handles setting the activity', async () => {
  const avatar = createMockAvatarData();
  const simulation = createSimulation(hasher);

  setSimulation(simulation);

  const activity = createMockActivityData();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  const event = new MessageEvent('message', { data: message });

  await handleClientMessage(event);

  expect(simulation.activity?.id).toBe(activity.id);
  expect(simulation.avatar?.id).toBe(avatar.id);
});
