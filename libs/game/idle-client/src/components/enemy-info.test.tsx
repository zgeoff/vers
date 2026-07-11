import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { nodeHasText } from '@vers/client-test-utils';
import type { EnemyAppState } from '@vers/idle-core';
import { EntityStatus } from '@vers/idle-core';
import { EnemyInfo } from './enemy-info';

test('it renders enemy information', () => {
  const enemy: EnemyAppState = {
    behaviours: {
      enemyPrimaryAttack: {
        lastAttackTime: 0,
      },
    },
    id: '1',
    isAlive: true,
    level: 1,
    life: 30,
    maxLife: 30,
    name: 'Test Enemy',
    primaryAttack: {
      maxDamage: 3,
      minDamage: 1,
      speed: 0.5,
    },
    status: EntityStatus.Alive,
  };

  render(<EnemyInfo enemy={enemy} />);

  const enemyName = screen.getByText('Test Enemy');
  const [lifeBar] = screen.getAllByText(nodeHasText('Life: 30 / 30'));

  expect(enemyName).toBeInTheDocument();
  expect(lifeBar).toBeInTheDocument();
});
