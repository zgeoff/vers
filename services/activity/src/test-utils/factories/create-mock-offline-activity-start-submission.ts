import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { EncounterNode, OfflineActivityStartSubmission } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';

interface CreateMockOfflineActivityStartSubmissionOverrides extends Partial<OfflineActivityStartSubmission> {
  readonly encounterNode?: Readonly<EncounterNode>;
  readonly keyVersion?: number;
}

export function createMockOfflineActivityStartSubmission(
  overrides: Readonly<CreateMockOfflineActivityStartSubmissionOverrides> = {},
): OfflineActivityStartSubmission {
  const {
    encounterNode: encounterNodeInput,
    keyVersion: keyVersionInput,
    ...submission
  } = overrides;

  const seed = submission.seed ?? faker.string.alphanumeric({ casing: 'lower', length: 32 });
  const simVersion = submission.simVersion ?? '0.0.0-dev';
  const contentVersion = submission.contentVersion ?? '2';
  const keyVersion = keyVersionInput ?? 1;
  const encounterNode = encounterNodeInput ?? { difficulty: faker.number.int({ max: 10, min: 1 }) };

  const startHash =
    submission.startHash ??
    buildStartHash({ contentVersion, encounterNode, keyVersion, seed, simVersion });

  return {
    avatarID: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion,
    playedAt: null,
    predecessorActivityID: null,
    scopeID: `${faker.number.int({ max: 99, min: -99 })}_${faker.number.int({ max: 99, min: -99 })}`,
    scopeType: 'world_map_node',
    seed,
    simVersion,
    startChainIndex: 0,
    startHash,
    startKey: `start_act_${createId()}`,
    ...submission,
  };
}
