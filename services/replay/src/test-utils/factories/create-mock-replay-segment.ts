import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { ReplaySegment } from '../../replay/types';

/**
 * A plain, unpersisted replay segment with faker-generated defaults, shaped like a chain's first
 * activity with no stored checkpoints — a chain-continuation scenario overrides `activity`,
 * `chain`, and `verifiedHead` together, since they must stay internally consistent.
 */
export function createMockReplaySegment(
  overrides: Readonly<Partial<ReplaySegment>> = {},
): ReplaySegment {
  const seed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });
  const prevHash = faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' });

  const segment: ReplaySegment = {
    activity: {
      avatarID: createId(),
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '0.0.0-dev',
      id: `act_${createId()}`,
      keyVersion: 1,
      scopeID: faker.string.alphanumeric({ casing: 'lower', length: 8 }),
      scopeType: 'world_map_node',
      seed,
      simVersion: 'test-engine-hash',
      startChainIndex: 0,
    },
    chain: { genesisSeed: seed, verifiedChainIndex: 0, verifiedNextSeed: seed },
    checkpoints: [],
    prevHash,
    seed,
    verifiedHead: 0,
  };

  return { ...segment, ...overrides };
}
