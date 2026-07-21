import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { makeNodeTextMatcher } from '@vers/client-test-utils';
import { createMockEnemySnapshot } from '@vers/idle-core/test-utils';
import { EnemyUnitPlate } from './enemy-unit-plate';

test('it renders the enemy identity, life, and swing timer', () => {
  const enemy = createMockEnemySnapshot({
    level: 3,
    life: 12,
    maxLife: 30,
    name: 'Rift Shade',
  });

  render(<EnemyUnitPlate enemy={enemy} />);

  expect(screen.getByText('Rift Shade')).toBeInTheDocument();
  expect(screen.getByText('LV 3')).toBeInTheDocument();
  expect(screen.getByText(makeNodeTextMatcher('12 / 30'))).toBeInTheDocument();
  expect(screen.getByText('ATTACK')).toBeInTheDocument();
});

test('it marks a defeated enemy', () => {
  const enemy = createMockEnemySnapshot({ isAlive: false, life: 0 });

  render(<EnemyUnitPlate enemy={enemy} />);

  expect(screen.getByText('DEFEATED')).toBeInTheDocument();
});
