import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { nodeHasText } from '@vers/client-test-utils';
import type { AvatarSnapshot } from '@vers/idle-core';
import { EntityStatus } from '@vers/idle-core';
import { AvatarInfo } from './avatar-info';

test('it renders avatar information', () => {
  const avatar: AvatarSnapshot = {
    behaviours: {
      avatar_weapon_attack: {
        lastAttackTime: 0,
      },
    },
    id: '1',
    isAlive: true,
    level: 1,
    life: 75,
    mainHandAttack: {
      maxDamage: 10,
      minDamage: 5,
      speed: 1,
    },
    maxLife: 100,
    name: 'Test Avatar',
    status: EntityStatus.Alive,
  };

  render(<AvatarInfo avatar={avatar} />);

  const avatarName = screen.getByText('Test Avatar');
  const [lifeBar] = screen.getAllByText(nodeHasText('Life: 75 / 100'));
  const level = screen.getByText(nodeHasText('Level 1'));

  expect(avatarName).toBeInTheDocument();
  expect(lifeBar).toBeInTheDocument();
  expect(level).toBeInTheDocument();
});
