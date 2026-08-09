import { faker } from '@faker-js/faker';
import type { EncounterNode } from '@vers/contract-activity';

/**
 * A plain stamped encounter node with a faker-generated difficulty and no sealed fields — override
 * `poolID` for a node stamped by a content version with sealed pool selection.
 */
export function createMockEncounterNode(
  overrides: Readonly<Partial<EncounterNode>> = {},
): EncounterNode {
  return {
    difficulty: faker.number.int({ max: 100, min: 1 }),
    ...overrides,
  };
}
