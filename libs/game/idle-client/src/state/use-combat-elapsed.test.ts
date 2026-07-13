import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { CombatExecutorSnapshot } from '@vers/idle-core';
import { setCombat } from './set-combat';
import { useCombatElapsed } from './use-combat-elapsed';

test('it provides the elapsed combat time', () => {
  const combat: CombatExecutorSnapshot = {
    elapsed: 1000,
  };

  setCombat(combat);

  const hook = renderHook(() => useCombatElapsed());

  expect(hook.result.current).toBe(1000);
});
