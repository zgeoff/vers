import { expect, test } from 'bun:test';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/factories/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/factories/create-mock-simulation-context';
import { CombatEventType } from '../../types';
import { createAvatarAttackEvent } from './create-avatar-attack-event';

test('it creates an avatar attack event', () => {
  const avatarData = createMockAvatarData();
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const time = 1000;
  const event = createAvatarAttackEvent(avatar, time);

  expect(event).toStrictEqual({
    id: expect.toBeString(),
    source: avatar.id,
    time,
    type: CombatEventType.AvatarAttack,
  });
});
