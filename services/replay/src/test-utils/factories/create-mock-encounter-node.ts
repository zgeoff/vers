import { faker } from '@faker-js/faker';
import type { EncounterNode } from '@vers/contract-activity';

export function createMockEncounterNode(
  overrides: Readonly<Partial<EncounterNode>> = {},
): EncounterNode {
  return {
    difficulty: faker.number.int({ max: 100, min: 1 }),
    ...overrides,
  };
}
