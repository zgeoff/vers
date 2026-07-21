import { expect, mock, test } from 'bun:test';
import { createMockActivityInput } from '../test-utils/factories/create-mock-activity-input';
import { createMockAvatarData } from '../test-utils/factories/create-mock-avatar-data';
import type { SimulationListener } from '../types';
import { ActivityCheckpointType, ActivityFailureAction } from '../types';
import { createSimulation } from './create-simulation';

test('it initializes with the expected values', () => {
  const simulation = createSimulation();

  expect(simulation.elapsed).toBe(0);
  expect(simulation.activity).toBeNull();
});

test('it starts an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activityData);

  expect(simulation.activity).toMatchObject({
    id: activityData.id,
    type: activityData.type,
  });
});

test('it calls an event listener when starting an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();
  const listenerSpy = mock<SimulationListener>();

  simulation.addEventListener('started', listenerSpy);
  simulation.startActivity(avatarData, activityData);

  expect(listenerSpy).toHaveBeenCalledExactlyOnceWith(simulation.state);
});

test('it stops an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activityData);
  simulation.stopActivity();

  expect(simulation.activity).toBeNull();
});

test('it calls an event listener when stopping an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();
  const listenerSpy = mock<SimulationListener>();

  simulation.addEventListener('stopped', listenerSpy);
  simulation.startActivity(avatarData, activityData);
  simulation.stopActivity();

  expect(listenerSpy).toHaveBeenCalledExactlyOnceWith(simulation.state);
});

test('it restarts an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activityData);

  const originalActivity = simulation.activity;

  simulation.restartActivity();

  expect(simulation.activity).not.toBe(originalActivity);
  expect(simulation.activity).not.toBeNull();
});

test('it calls an event listener when restarting an activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const simulation = createSimulation();
  const listenerSpy = mock<SimulationListener>();

  simulation.addEventListener('restarted', listenerSpy);
  simulation.startActivity(avatarData, activityData);
  simulation.restartActivity();

  expect(listenerSpy).toHaveBeenCalledExactlyOnceWith(simulation.state);
});

test('it resets the avatar when restarting an activity', () => {
  const avatarData = createMockAvatarData({ life: 100 });
  const activityData = createMockActivityInput();
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activityData);
  simulation.state.avatar?.receiveDamage(50);
  expect(simulation.state.avatar?.life).toBe(50);

  simulation.restartActivity();

  expect(simulation.state.avatar?.life).toBe(100);
});

test('it runs an activity and returns checkpoints', () => {
  const avatarData = createMockAvatarData();
  const simulation = createSimulation();
  const activityData = createMockActivityInput();

  simulation.startActivity(avatarData, activityData);

  const firstCheckpoint = simulation.run(100);

  expect(firstCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: expect.toBeString(),
    time: 0,
    type: ActivityCheckpointType.Started,
  });

  const secondCheckpoint = simulation.run(10_000);

  expect(secondCheckpoint).toStrictEqual({
    nextSeed: expect.toBeString(),
    rewards: expect.toBeObject(),
    rewardSlots: expect.toBeArray(),
    time: expect.toBeNumber(),
    type: ActivityCheckpointType.Progress,
  });

  expect(simulation.elapsed).toBe(10_100);
});

test('it calls an event listener when the state updates', () => {
  const avatarData = createMockAvatarData();
  const simulation = createSimulation();
  const activityData = createMockActivityInput();
  const listenerSpy = mock<SimulationListener>();

  simulation.addEventListener('updated', listenerSpy);
  simulation.startActivity(avatarData, activityData);

  // skip our initialisation state
  simulation.run(1);

  // run long enough for an attack cycle to occur
  simulation.run(5000);

  expect(listenerSpy).toHaveBeenCalledExactlyOnceWith(simulation.state);
});

test('it returns the expected simulation state for a client app', () => {
  const simulation = createSimulation();
  const state = simulation.getSnapshot();

  expect(state).toStrictEqual({ failureAction: ActivityFailureAction.Abort });
});

test('it seeds the failure action from the started activity', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput({ failureAction: ActivityFailureAction.Retry });
  const simulation = createSimulation();

  simulation.startActivity(avatarData, activityData);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
});

test('it updates the failure action', () => {
  const simulation = createSimulation();

  simulation.setFailureAction(ActivityFailureAction.Retry);

  expect(simulation.failureAction).toBe(ActivityFailureAction.Retry);
  expect(simulation.getSnapshot().failureAction).toBe(ActivityFailureAction.Retry);
});

test('it calls an event listener when the failure action updates', () => {
  const simulation = createSimulation();
  const listenerSpy = mock<SimulationListener>();

  simulation.addEventListener('updated', listenerSpy);
  simulation.setFailureAction(ActivityFailureAction.Retry);

  expect(listenerSpy).toHaveBeenCalledExactlyOnceWith(simulation.state);
});

test('it produces an identical checkpoint stream with and without an updated listener', () => {
  const avatarData = createMockAvatarData();
  const activityData = createMockActivityInput();
  const withoutListener = createSimulation();

  withoutListener.startActivity(avatarData, activityData);

  const checkpointsWithoutListener = [
    withoutListener.run(1),
    withoutListener.run(5000),
    withoutListener.run(10_000),
  ];

  const withListener = createSimulation();

  withListener.addEventListener('updated', () => {});
  withListener.startActivity(avatarData, activityData);

  const checkpointsWithListener = [
    withListener.run(1),
    withListener.run(5000),
    withListener.run(10_000),
  ];

  expect(checkpointsWithListener).toStrictEqual(checkpointsWithoutListener);
});
