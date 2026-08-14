import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { EncounterNode } from '@vers/contract-activity';
import type { NodeSeed } from '../../submission/types';

interface CreateMockNodeSeedOverrides {
  readonly avatarID?: string;
  readonly contentVersion?: string;
  readonly encounterNode?: EncounterNode;
  readonly genesisSeed?: string;
  readonly nodeID?: string;
}

export function createMockNodeSeed(overrides: CreateMockNodeSeedOverrides = {}): NodeSeed {
  return {
    avatarID: overrides.avatarID ?? `avatar_${createId()}`,
    contentVersion: overrides.contentVersion ?? faker.number.int({ max: 100, min: 1 }).toString(),
    encounterNode: overrides.encounterNode ?? buildEncounterNode(),
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

function buildEncounterNode(): EncounterNode {
  return { difficulty: faker.number.int({ max: 50, min: 1 }), poolID: `pool_${createId()}` };
}
