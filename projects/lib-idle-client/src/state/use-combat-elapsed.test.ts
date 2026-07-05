import { renderHook } from '@testing-library/react';
import type { CombatExecutorAppState } from '@vers/idle-core';
import { expect, test } from 'vitest';
import { setCombat } from './set-combat';
import { useCombatElapsed } from './use-combat-elapsed';

test('it provides the elapsed combat time', () => {
  const combat: CombatExecutorAppState = {
    elapsed: 1000,
  };

  setCombat(combat);

  const { result } = renderHook(() => useCombatElapsed());

  expect(result.current).toBe(1000);
});
