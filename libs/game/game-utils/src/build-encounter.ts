import { hexToBytes } from '@noble/hashes/utils.js';
import { buildRollStream } from '@vers/roll-crypto';
import { rollEncounterFromStream } from './roll-encounter-from-stream';
import type { EncounterContent, EncounterDefinition, EncounterNode } from './types';

const ENCOUNTER_STREAM_DOMAIN = 'encounter';

export interface BuildEncounterInput {
  readonly content: EncounterContent;
  readonly node: EncounterNode;
  readonly seed: string;
}

/**
 * Builds the encounter's own domain-separated roll stream off the activity seed and resolves a
 * full encounter from it. The stream is disjoint from the sim's combat-roll stream by domain
 * label, so an engine refactor can't reshuffle an encounter and an encounter content change can't
 * perturb combat rolls; the client worker and the verifier both call this from the same activity
 * row, so an encounter is byte-identical on both sides.
 */
export function buildEncounter(input: Readonly<BuildEncounterInput>): EncounterDefinition {
  const stream = buildRollStream(hexToBytes(input.seed), ENCOUNTER_STREAM_DOMAIN);

  return rollEncounterFromStream(input.content, input.node, stream);
}
