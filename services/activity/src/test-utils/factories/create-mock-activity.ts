import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { EncounterNode } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Insertable } from 'kysely';

interface CreateMockActivityOverrides extends Omit<
  Partial<Insertable<Activities>>,
  'encounterNode'
> {
  readonly encounterNode?: Readonly<EncounterNode>;
}

export function createMockActivity(
  overrides: Readonly<CreateMockActivityOverrides> = {},
): Insertable<Activities> {
  const id = overrides.id ?? `act_${createId()}`;
  const seed = overrides.seed ?? faker.string.alphanumeric({ casing: 'lower', length: 32 });
  const simVersion = overrides.simVersion ?? '0.0.0-dev';
  const contentVersion = overrides.contentVersion ?? '0.0.0-dev';
  const keyVersion = overrides.keyVersion ?? 1;

  const encounterNode = overrides.encounterNode ?? {
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
    secretRef: 'worldmap',
    secretVersion: 1,
    seed,
    simVersion,
    startHash,
    ...overrides,
  };
}
