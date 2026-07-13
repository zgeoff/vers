import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Activities } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted activity head row with faker-generated defaults. Never requires a parent —
 * `avatarId` defaults to a random id, not a real avatar's. Hash fields default to opaque strings:
 * the replay primitives read cursors and status, never the hash chain.
 */
export function createMockActivityRow(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Activities' jsonb `buildSnapshot` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
  overrides: Partial<Insertable<Activities>> = {},
): Insertable<Activities> {
  const startHash = faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });

  return {
    avatarId: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    id: `act_${createId()}`,
    lastHash: startHash,
    scopeId: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
    scopeType: 'world_map_node',
    seed: faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' }),
    simVersion: '0.0.0-dev',
    startHash,
    ...overrides,
  };
}
