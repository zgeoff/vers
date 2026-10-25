import type { ModelActivity } from '../settlement-model/types';
import { buildMockModelCheckpoint } from './build-mock-model-checkpoint';

export function buildMockModelActivity(
  overrides: Readonly<Partial<ModelActivity>> = {},
): ModelActivity {
  return {
    appendedHead: 0,
    buildXP: 0,
    checkpoints: [
      buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
      buildMockModelCheckpoint({ version: 2, xp: 10 }),
      buildMockModelCheckpoint({ version: 3, xp: 8 }),
    ],
    id: 'act_model',
    predecessorID: null,
    scopeID: '0_0',
    settledXP: 0,
    startChainIndex: 0,
    status: 'active',
    tamperedVersion: null,
    verifiedHead: 0,
    writer: null,
    ...overrides,
  };
}
