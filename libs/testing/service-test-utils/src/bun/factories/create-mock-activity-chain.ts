import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { ActivityChains } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted chain row with faker-generated defaults. Never requires a parent —
 * `avatarId` defaults to a random id, not a real avatar's. `genesisSeed`, `appendedNextSeed`, and
 * `verifiedNextSeed` all default to the same freshly rolled hex seed, mirroring a chain at its
 * just-revealed genesis position.
 */
export function createMockActivityChain(
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
