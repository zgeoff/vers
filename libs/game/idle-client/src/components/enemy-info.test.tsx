import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { nodeHasText } from '@vers/client-test-utils';
import { createMockEnemySnapshot } from '@vers/idle-core/test-utils';
import { EnemyInfo } from './enemy-info';

test('it renders enemy information', () => {
  const enemy = createMockEnemySnapshot({
    behaviours: {
      enemy_primary_attack: {
        lastAttackTime: 0,
      },
    },
    id: '1',
  });

  render(<EnemyInfo enemy={enemy} />);

  const enemyName = screen.getByText('Test Enemy');
  const [lifeBar] = screen.getAllByText(nodeHasText('Life: 30 / 30'));

  expect(enemyName).toBeInTheDocument();
  expect(lifeBar).toBeInTheDocument();
});
