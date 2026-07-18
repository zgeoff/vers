import { expect, test } from 'bun:test';
import { EncounterDefinitionSchema } from './encounter-definition-schema';

test('it accepts a well-formed encounter definition', () => {
  const result = EncounterDefinitionSchema.safeParse({
    waves: [
      [
        {
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        },
      ],
    ],
  });

  expect(result.success).toBeTrue();
});

test('it accepts an encounter with no waves', () => {
  const result = EncounterDefinitionSchema.safeParse({ waves: [] });

  expect(result.success).toBeTrue();
});

test('it rejects a wave with a malformed enemy', () => {
  const result = EncounterDefinitionSchema.safeParse({
    waves: [[{ level: 1, life: 30, name: 'Test Enemy', primaryAttack: { speed: 0.5 }, xp: 10 }]],
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['waves', 0, 0, 'primaryAttack', 'maxDamage'] }),
  );
});
