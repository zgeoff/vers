import { expect, test } from 'vitest';
import { createAvatar } from '../../entities/create-avatar';
import { createMockAvatarData } from '../../test-utils/create-mock-avatar-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { CombatEventType } from '../../types';
import { createAvatarAttackEvent } from './create-avatar-attack-event';

test('it creates an avatar attack event', () => {
  const avatarData = createMockAvatarData();
  const ctx = createMockSimulationContext();
  const avatar = createAvatar(avatarData, ctx);
  const time = 1000;

  const event = createAvatarAttackEvent(avatar, time);

  expect(event).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    source: avatar.id,
    time,
    type: CombatEventType.AvatarAttack,
  });
});
