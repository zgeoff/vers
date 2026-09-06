import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockLiveRun } from '../test-utils/factories/create-mock-live-run';
import { useIdleStore } from './use-idle-store';
import { useLiveRun } from './use-live-run';

test('it provides the live run', () => {
  useIdleStore.setState({
    liveRun: createMockLiveRun({ avatarID: 'avatar_1', id: 'activity_1', scopeID: '0_0' }),
  });

  const hook = renderHook(() => useLiveRun());

  expect(hook.result.current).toStrictEqual({
    avatarID: 'avatar_1',
    id: 'activity_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });
});

test('it provides null while no run is live', () => {
  const hook = renderHook(() => useLiveRun());

  expect(hook.result.current).toBeNull();
});
