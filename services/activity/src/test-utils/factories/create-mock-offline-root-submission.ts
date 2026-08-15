import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { EncounterNode, OfflineRootSubmission } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';

/**
 * The factory's own overrides shape: `OfflineRootSubmission`'s fields, except `encounterNode`
 * narrows to the contract type explicitly for parity with the row factories.
 */
interface CreateMockOfflineRootSubmissionOverrides extends Omit<
  Partial<OfflineRootSubmission>,
  'encounterNode'
> {
  readonly encounterNode?: Readonly<EncounterNode>;
}

/**
 * A plain, unpersisted root submission with faker-generated defaults, mirroring
 * `createMockActivity`'s shape: `avatarID` defaults to a random id, not a real avatar's, and
 * `startHash` defaults to the real start hash of the submission's own hash inputs, so a
 * factory-built submission mints correctly against a matching chain and build snapshot.
 */
export function createMockOfflineRootSubmission(
  overrides: Readonly<CreateMockOfflineRootSubmissionOverrides> = {},
): OfflineRootSubmission {
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
    avatarID: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion,
    encounterNode,
    keyVersion,
    scopeID: `${faker.number.int({ max: 99, min: -99 })}_${faker.number.int({ max: 99, min: -99 })}`,
    scopeType: 'world_map_node',
    secretRef: 'worldmap',
    secretVersion: 1,
    seed,
    simVersion,
    startChainIndex: 0,
    startHash,
    startKey: `root_act_${createId()}`,
    ...overrides,
  };
}
