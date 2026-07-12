import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted activity row with faker-generated defaults. Never requires a parent —
 * `avatarId` defaults to a random id, not a real avatar's. `lastHash`/`startHash` default to the
 * real `buildStartHash` of the row's own `id`/`seed`/version fields, so a factory-built row chains
 * correctly with `createMockCheckpointBatch`.
 */
export function createMockActivity(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Activities' jsonb `buildSnapshot` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
  overrides: Partial<Insertable<Activities>> = {},
): Insertable<Activities> {
  const id = overrides.id ?? `act_${createId()}`;
  const seed = overrides.seed ?? faker.string.alphanumeric({ casing: 'lower', length: 32 });
  const simVersion = overrides.simVersion ?? '0.0.0-dev';
  const contentVersion = overrides.contentVersion ?? '0.0.0-dev';

  const startHash =
    overrides.startHash ?? buildStartHash({ activityID: id, contentVersion, seed, simVersion });

  return {
    avatarId: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion,
    id,
    lastHash: startHash,
    nodeId: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
    seed,
    simVersion,
    startHash,
    ...overrides,
  };
}
