import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { useActivity } from './use-activity';
import { useIdleStore } from './use-idle-store';

test('it provides activity state', () => {
  const activity = createMockActivitySnapshot({
    enemiesRemaining: 20,
    id: 'test-activity',
    name: 'Test Activity',
    wavesRemaining: 4,
  });

  useIdleStore.setState({ activity });

  const hook = renderHook(() => useActivity());

  expect(hook.result.current).toStrictEqual({
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 20,
    id: 'test-activity',
    levelUp: null,
    name: 'Test Activity',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 4,
  });
});
