import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { ReplaySegment } from '../../replay/types';

interface CreateMockReplaySegmentOverrides extends Partial<
  Omit<ReplaySegment, 'activity' | 'chain'>
> {
  readonly activity?: Partial<ReplaySegment['activity']>;
  readonly chain?: Partial<ReplaySegment['chain']>;
}

/**
 * A plain, unpersisted replay segment with faker-generated defaults, shaped like a chain's first
 * activity with no stored checkpoints. `chain.genesisSeed`/`verifiedNextSeed` and the top-level
 * `seed` rebuild from a merged `activity` override's own `seed` unless the caller explicitly
 * overrides them too — a chain-continuation scenario overrides `chain` and `verifiedHead`
 * directly for that reason.
 */
export function createMockReplaySegment(
  overrides: Readonly<CreateMockReplaySegmentOverrides> = {},
): ReplaySegment {
  const randomSeed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });
  const prevHash = faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });

  const activity: ReplaySegment['activity'] = {
    appendedHead: 0,
    appendedTimeMs: 0,
    avatarID: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    id: `act_${createId()}`,
    keyVersion: 1,
    scopeID: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
    scopeType: 'world_map_node',
    secretRef: null,
    secretVersion: null,
    settledXP: 0,
    seed: randomSeed,
    simVersion: 'test-engine-hash',
    startChainIndex: 0,
    status: 'active',
    ...overrides.activity,
  };

  const chain: ReplaySegment['chain'] = {
    genesisSeed: activity.seed,
    verifiedChainIndex: 0,
    verifiedNextSeed: activity.seed,
    ...overrides.chain,
  };

  return {
    checkpoints: [],
    prevHash,
    seed: activity.seed,
    verifiedHead: 0,
    ...overrides,
    activity,
    chain,
  };
}
