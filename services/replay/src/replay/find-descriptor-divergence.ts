import type { EncounterContent } from '@vers/game-utils';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { findCellCoord, getDifficulty } from '@vers/worldmap-core';
import type { CompareVerdict } from './types';

interface FindDescriptorDivergenceInput {
  readonly content: Readonly<EncounterContent>;
  readonly scopeID: string;
  readonly scopeSecret: Uint8Array;
  readonly stampedEncounterNode: {
    readonly difficulty: number;
    readonly poolID?: string | undefined;
  };
  readonly userSeed: number;
}

export function findDescriptorDivergence(
  input: Readonly<FindDescriptorDivergenceInput>,
): Extract<CompareVerdict, { kind: 'divergence' }> | undefined {
  const coord = findCellCoord(input.scopeID);

  if (coord === undefined) {
    return { kind: 'divergence', reason: 'descriptor-mismatch', version: 1 };
  }

  const truth = {
    difficulty: getDifficulty(coord[0], coord[1]),
    ...deriveWorldmapContent(input.content, {
      coord,
      scopeSecret: input.scopeSecret,
      userSeed: input.userSeed,
    }),
  };

  const matches =
    truth.difficulty === input.stampedEncounterNode.difficulty &&
    truth.poolID === input.stampedEncounterNode.poolID;

  return matches ? undefined : { kind: 'divergence', reason: 'descriptor-mismatch', version: 1 };
}
