import { expect, test } from 'bun:test';
import { AttackDataSchema } from './attack-data-schema';

test('it accepts well-formed attack data', () => {
  const result = AttackDataSchema.safeParse({ maxDamage: 20, minDamage: 10, speed: 0.8 });

  expect(result.success).toBeTrue();
});

test('it rejects a non-numeric field', () => {
  const result = AttackDataSchema.safeParse({ maxDamage: '20', minDamage: 10, speed: 0.8 });

  expect(result.success).toBeFalse();
});
