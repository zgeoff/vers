import type { CheckpointPayload } from '@vers/contract-activity';
import type { ActivityCheckpoint } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ModelActivity, ModelCheckpoint } from './types';

interface StreamCheckpoint {
  readonly hash: string;
  readonly payload: CheckpointPayload;
  readonly prevHash: string;
  readonly version: number;
}

interface BuildModelActivityInput {
  readonly buildXP: number;
  readonly checkpoints: ReadonlyArray<StreamCheckpoint>;
  readonly engineCheckpoints: ReadonlyArray<ActivityCheckpoint>;
  readonly id: string;
  readonly predecessorID: null | string;
  readonly scopeID: string;
  readonly startChainIndex: number;
}

export function buildModelActivity(input: Readonly<BuildModelActivityInput>): ModelActivity {
  const checkpoints = input.checkpoints.map((checkpoint, index): ModelCheckpoint => {
    const engine = input.engineCheckpoints[index];

    invariant(engine, 'every stored checkpoint has the engine checkpoint it was built from');

    const entry = {
      hash: checkpoint.hash,
      payload: checkpoint.payload,
      prevHash: checkpoint.prevHash,
      version: checkpoint.version,
    };

    return {
      entry,

      // rewards sit outside the checkpoint hash, so the activity service accepts a forged claim
      // and only a replay catches it
      forgedEntry: {
        ...entry,
        payload: { ...entry.payload, rewards: { ...engine.rewards, xp: engine.rewards.xp + 1 } },
      },
      rewardOrdinals: engine.rewardSlots.map((slot) => slot.ordinal),
      type: engine.type,
      xp: engine.rewards.xp,
    };
  });

  return {
    appendedHead: 0,
    buildXP: input.buildXP,
    checkpoints,
    id: input.id,
    predecessorID: input.predecessorID,
    scopeID: input.scopeID,
    settledXP: 0,
    startChainIndex: input.startChainIndex,
    status: 'active',
    tamperedVersion: null,
    verifiedHead: 0,
    writer: null,
  };
}
