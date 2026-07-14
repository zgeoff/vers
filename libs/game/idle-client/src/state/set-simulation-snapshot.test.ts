import { expect, test } from 'bun:test';
import { ActivityFailureAction, createMockActivitySnapshot } from '@vers/idle-core';
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
