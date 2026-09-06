import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { setSimulationSnapshot } from './set-simulation-snapshot';
import { useIdleStore } from './use-idle-store';

test('it applies a whole snapshot in one update', () => {
  let notifications = 0;

  const unsubscribe = useIdleStore.subscribe(() => {
    notifications += 1;
  });

  setSimulationSnapshot({
    combat: { elapsed: 1000 },
    failureAction: ActivityFailureAction.Retry,
  });

  unsubscribe();

  expect(notifications).toBe(1);
  expect(useIdleStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);
});

test('it clears fields the snapshot omits', () => {
  useIdleStore.setState({ activity: null, avatar: null });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    failureAction: ActivityFailureAction.Abort,
  });

  setSimulationSnapshot({ failureAction: ActivityFailureAction.Abort });

  expect(useIdleStore.getState().activity).toBeNull();
  expect(useIdleStore.getState().avatar).toBeNull();
  expect(useIdleStore.getState().combat).toBeNull();
});

test('it resets the reward-slot ledger the moment the active activity changes', () => {
  useIdleStore.setState({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_2' }),
    failureAction: ActivityFailureAction.Retry,
  });

  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([]);
  expect(useIdleStore.getState().rewardSlotLedgerActivityID).toBe('activity_2');
});

test('it leaves the reward-slot ledger untouched while the active activity stays the same', () => {
  useIdleStore.setState({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    failureAction: ActivityFailureAction.Retry,
  });

  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  expect(useIdleStore.getState().rewardSlotLedgerActivityID).toBe('activity_1');
});

test('it resets the reward-slot ledger once, not on every snapshot of the new activity', () => {
  useIdleStore.setState({
    activity: createMockActivitySnapshot({ id: 'activity_1' }),
    rewardSlotLedger: [{ count: 2, version: 1 }],
    rewardSlotLedgerActivityID: 'activity_1',
  });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_2' }),
    failureAction: ActivityFailureAction.Retry,
  });

  useIdleStore.setState({ rewardSlotLedger: [{ count: 9, version: 1 }] });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot({ id: 'activity_2' }),
    failureAction: ActivityFailureAction.Retry,
  });

  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 9, version: 1 }]);
});

test('it records the live run beside the snapshot', () => {
  setSimulationSnapshot(
    {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Abort,
    },
    { avatarID: 'avatar_1', id: 'activity_1', scopeID: '0_0', scopeType: 'world_map_node' },
  );

  expect(useIdleStore.getState().liveRun).toStrictEqual({
    avatarID: 'avatar_1',
    id: 'activity_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });
});

test('it clears the live run when the snapshot carries none', () => {
  useIdleStore.setState({
    liveRun: {
      avatarID: 'avatar_1',
      id: 'activity_1',
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
  });

  setSimulationSnapshot({ failureAction: ActivityFailureAction.Abort });

  expect(useIdleStore.getState().liveRun).toBeNull();
});
