import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { NodeSeed } from '../../submission/types';

interface CreateMockNodeSeedOverrides {
  readonly avatarID?: string;
  readonly genesisSeed?: string;
  readonly nodeID?: string;
}

export function createMockNodeSeed(overrides: CreateMockNodeSeedOverrides = {}): NodeSeed {
  return {
    avatarID: overrides.avatarID ?? `avatar_${createId()}`,
    genesisSeed:
      overrides.genesisSeed ?? faker.string.alphanumeric({ casing: 'lower', length: 16 }),
    nodeID: overrides.nodeID ?? buildNodeID(),
  };
}

function buildNodeID(): string {
  const cx = faker.number.int({ max: 100, min: -100 });
  const cy = faker.number.int({ max: 100, min: -100 });

  return `${cx}_${cy}`;
}
