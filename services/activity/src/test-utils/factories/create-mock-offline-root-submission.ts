import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { EncounterNode, OfflineRootSubmission } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';

/**
 * The factory's overrides: every `OfflineRootSubmission` field, plus the client-cached
 * `encounterNode` and `keyVersion` the default `startHash` folds in. Those two are inputs to the
 * hash the client computes locally, never fields of the wire submission the server ingests — the
 * server re-derives them from its own content and scope secret — so they are consumed here and
 * dropped from the returned value.
 */
interface CreateMockOfflineRootSubmissionOverrides extends Partial<OfflineRootSubmission> {
  readonly encounterNode?: Readonly<EncounterNode>;
  readonly keyVersion?: number;
}

/**
 * A plain, unpersisted root submission with faker-generated defaults. `avatarID` defaults to a
 * random id, not a real avatar's, and `startHash` defaults to the real start hash of the client's
 * own cached inputs. A test whose root must mint against a real server derivation overrides
 * `startHash` with the hash the server recomputes — the encounter the server derives is not
 * knowable from these defaults alone.
 */
export function createMockOfflineRootSubmission(
  overrides: Readonly<CreateMockOfflineRootSubmissionOverrides> = {},
): OfflineRootSubmission {
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
    startKey: `root_act_${createId()}`,
    ...submission,
  };
}
