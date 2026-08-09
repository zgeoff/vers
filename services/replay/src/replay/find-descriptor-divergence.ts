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
}

/**
 * Compares a segment's stamped, server-sealed node fields against the server's own
 * recomputation: difficulty from the activity's scope id alone, and every sealed content field
 * the content derivation yields for the activity's pinned content and a freshly read scope
 * secret. A scope id that no longer resolves to a coordinate is itself a divergence. Undefined
 * means no divergence found here.
 */
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
      userSeed: 0,
    }),
  };

  const matches =
    truth.difficulty === input.stampedEncounterNode.difficulty &&
    truth.poolID === input.stampedEncounterNode.poolID;

  return matches ? undefined : { kind: 'divergence', reason: 'descriptor-mismatch', version: 1 };
}
