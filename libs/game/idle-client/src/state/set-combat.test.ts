import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import type { CombatExecutorAppState } from '@vers/idle-core';
import { setCombat } from './set-combat';
import { useCombatStore } from './use-combat-store';

test('it updates the combat state', () => {
  const combat: CombatExecutorAppState = {
    elapsed: 1000,
  };

  setCombat(combat);

  const hook = renderHook(() => useCombatStore((state) => state.combat));

  expect(hook.result.current).toStrictEqual({
    elapsed: 1000,
  });
});
