import type { RollStream } from '@vers/roll-crypto';
import invariant from 'tiny-invariant';
import type {
  EncounterArchetype,
  EncounterContent,
  EncounterDefinition,
  EncounterEnemy,
  EncounterNode,
} from './types';

/**
 * Floor for a node's difficulty, so a difficulty-0 node (the world map's unscaled origin) still
 * produces a viable encounter multiplier instead of a zero one.
 */
export const MIN_DIFFICULTY = 1;

/**
 * Resolves a full encounter — wave count, each wave's enemy count, archetype picks, and
 * difficulty-scaled stats — from a stream of typed draws, in that draw order, so identical
 * content, node, and stream always produce identical waves. A stamped `poolID` selects that pool;
 * its absence falls back to the content's first registered pool, matching a pre-sealing node
 * byte-for-byte. Picking the pool from the node consumes no stream draws — every draw below is
 * spent inside whichever pool was selected, keeping reward magnitude variance confined to sealed
 * content rather than the roll stream (the flat-base law).
 */
export function rollEncounterFromStream(
  content: Readonly<EncounterContent>,
  node: Readonly<EncounterNode>,
  stream: RollStream,
): EncounterDefinition {
  const pool =
    node.poolID === undefined
      ? content.pools[0]
      : content.pools.find((candidate) => candidate.id === node.poolID);

  invariant(pool, `node poolID must reference a known pool: ${node.poolID}`);

  const weightedArchetypes = pool.entries.map((entry) => {
    const archetype = content.archetypes.find((candidate) => candidate.id === entry.archetypeID);

    invariant(archetype, `pool entry must reference a known archetype: ${entry.archetypeID}`);

    return { value: archetype, weight: entry.weight };
  });

  const multiplier =
    Math.max(node.difficulty, MIN_DIFFICULTY) * content.tuning.difficultyScalingFactor;

  const waveCount = stream.rollRange(content.tuning.waveCountMin, content.tuning.waveCountMax);

  const waves = Array.from({ length: waveCount }, () => {
    const waveSize = stream.rollRange(content.tuning.waveSizeMin, content.tuning.waveSizeMax);

    return Array.from(
      { length: waveSize },
      (): EncounterEnemy => buildEnemy(stream.pickWeighted(weightedArchetypes), multiplier),
    );
  });

  return { waves };
}

function buildEnemy(archetype: Readonly<EncounterArchetype>, multiplier: number): EncounterEnemy {
  return {
    level: archetype.baseLevel,
    life: Math.round(archetype.baseLife * multiplier),
    name: archetype.name,
    primaryAttack: {
      maxDamage: Math.round(archetype.attackMax * multiplier),
      minDamage: Math.round(archetype.attackMin * multiplier),
      speed: archetype.attackSpeed,
    },
    xp: Math.round(archetype.baseXP * multiplier),
  };
}
