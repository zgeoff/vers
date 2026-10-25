import type { ModelCheckpoint } from '../settlement-model/types';

interface BuildMockModelCheckpointInput {
  readonly rewardOrdinals?: ReadonlyArray<number>;
  readonly type?: string;
  readonly version: number;
  readonly xp?: number;
}

export function buildMockModelCheckpoint(
  input: Readonly<BuildMockModelCheckpointInput>,
): ModelCheckpoint {
  const type = input.type ?? 'progress';
  const xp = input.xp ?? 10;

  const entry = {
    hash: `hash-${input.version}`,
    payload: {
      chainIndex: input.version,
      entropySource: 'server-key' as const,
      nextSeed: `seed-${input.version}`,
      rewards: { xp },
      seed: `seed-${input.version - 1}`,
      time: input.version * 1000,
      type,
    },
    prevHash: `hash-${input.version - 1}`,
    version: input.version,
  };

  return {
    entry,
    forgedEntry: { ...entry, payload: { ...entry.payload, rewards: { xp: xp + 1 } } },
    rewardOrdinals: input.rewardOrdinals ?? [],
    type,
    xp,
  };
}
