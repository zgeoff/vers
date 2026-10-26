import { ActivityFailureAction } from '@vers/idle-core';
import type { LoadEngineVersions, PlayerProfile } from './types';

// the build corpus: levels from a fresh avatar to one that clears the origin in a few waves, so
// the stream mixes failed and completed attempts of different lengths
const LEVEL_CORPUS: ReadonlyArray<number> = [1, 2, 3, 5, 8, 12];

interface BuildPlayerProfilesInput {
  readonly count: number;
  readonly firstIndex: number;
  readonly retainedEvery: number;
  readonly versions: LoadEngineVersions;
}

// deterministic per player index, so a rerun repeats each player's level and sim version; the
// fights differ, because each stack creates new avatars and draws new genesis seeds
export function buildPlayerProfiles(
  input: Readonly<BuildPlayerProfilesInput>,
): Array<PlayerProfile> {
  return Array.from({ length: input.count }, (_, offset) => {
    const index = input.firstIndex + offset;

    return {
      failureAction: ActivityFailureAction.Retry,
      index,
      level: LEVEL_CORPUS[index % LEVEL_CORPUS.length] ?? 1,
      simVersion:
        index % input.retainedEvery === 0 ? input.versions.retained : input.versions.current,
    };
  });
}
