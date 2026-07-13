import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { ActivityChains } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted chain row with faker-generated defaults. Never requires a parent —
 * `avatarId` defaults to a random id, not a real avatar's. Both anchors default to the genesis
 * seed at index zero, a chain no activity has drawn from yet.
 */
export function createMockChainRow(
  overrides: Readonly<Partial<Insertable<ActivityChains>>> = {},
): Insertable<ActivityChains> {
  const genesisSeed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });

  return {
    appendedNextSeed: genesisSeed,
    avatarId: createId(),
    genesisSeed,
    scopeId: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
    scopeType: 'world_map_node',
    verifiedNextSeed: genesisSeed,
    ...overrides,
  };
}
