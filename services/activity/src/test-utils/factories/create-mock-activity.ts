import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted activity row with faker-generated defaults. Never requires a parent —
 * `avatarId` defaults to a random id, not a real avatar's. `lastHash`/`startHash` default to the
 * real start hash of the row's own hash inputs, so a factory-built row chains correctly with a mock
 * checkpoint batch.
 */
export function createMockActivity(
  overrides: Readonly<Partial<Insertable<Activities>>> = {},
): Insertable<Activities> {
  const id = overrides.id ?? `act_${createId()}`;
  const seed = overrides.seed ?? faker.string.alphanumeric({ casing: 'lower', length: 32 });
  const simVersion = overrides.simVersion ?? '0.0.0-dev';
  const contentVersion = overrides.contentVersion ?? '0.0.0-dev';
  const keyVersion = overrides.keyVersion ?? 1;

  const encounterNode =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this factory's own schema-shaped literal
    (overrides.encounterNode as { difficulty: number } | undefined) ?? {
      difficulty: faker.number.int({ max: 10, min: 1 }),
    };

  const startHash =
    overrides.startHash ??
    buildStartHash({ contentVersion, encounterNode, keyVersion, seed, simVersion });

  return {
    avatarId: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion,
    encounterNode,
    id,
    keyVersion,
    lastHash: startHash,
    scopeId: `${faker.number.int({ max: 99, min: -99 })}_${faker.number.int({ max: 99, min: -99 })}`,
    scopeType: 'world_map_node',
    seed,
    simVersion,
    startHash,
    ...overrides,
  };
}
