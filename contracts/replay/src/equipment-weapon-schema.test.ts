import { expect, test } from 'bun:test';
import { EquipmentWeaponSchema } from './equipment-weapon-schema';

test('it accepts a well-formed weapon', () => {
  const result = EquipmentWeaponSchema.safeParse({
    id: 'weapon_1',
    maxDamage: 20,
    minDamage: 10,
    name: 'Bastard Sword',
    speed: 0.8,
  });

  expect(result.success).toBeTrue();
});

test('it rejects a weapon missing a required field', () => {
  const result = EquipmentWeaponSchema.safeParse({
    id: 'weapon_1',
    maxDamage: 20,
    name: 'Bastard Sword',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['minDamage'] }));
});
