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

export function buildEncounter(input: Readonly<BuildEncounterInput>): EncounterDefinition {
  const stream = buildRollStream(hexToBytes(input.seed), ENCOUNTER_STREAM_DOMAIN);

  return rollEncounterFromStream(input.content, input.node, stream);
}
