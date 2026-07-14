import { expect, test } from 'bun:test';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { EntityStatus } from '../../types';
import { createAvatar } from '../create-avatar';
import { handleReceiveAvatarDamage } from './handle-receive-avatar-damage';

test('it reduces the life of the entity by the amount of damage received', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData({ life: 100 });
  const avatar = createAvatar(avatarData, ctx);

  handleReceiveAvatarDamage(10, avatar);
  expect(avatar.life).toBe(90);
});

test('it sets the status to dead if the life is 0 or less', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData({ life: 100 });
  const avatar = createAvatar(avatarData, ctx);

  handleReceiveAvatarDamage(100, avatar);
  expect(avatar.status).toBe(EntityStatus.Dead);
});

test('it does not reduce the life below 0', () => {
  const ctx = createMockSimulationContext();
  const avatarData = createMockAvatarData({ life: 10 });
  const avatar = createAvatar(avatarData, ctx);

  handleReceiveAvatarDamage(100, avatar);
  expect(avatar.life).toBe(0);
});
