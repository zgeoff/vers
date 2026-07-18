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
 * Resolves a full encounter — wave count, each wave's enemy count, archetype picks, and
 * difficulty-scaled stats — from a stream of typed draws, in that draw order, so identical
 * content, node, and stream always produce identical waves. The node selects only the stat
 * multiplier for now; pool selection is the content's single default pool until node content
 * lands.
 */
export function rollEncounterFromStream(
  content: Readonly<EncounterContent>,
  node: Readonly<EncounterNode>,
  stream: RollStream,
): EncounterDefinition {
  const [pool] = content.pools;

  const weightedArchetypes = pool.entries.map((entry) => {
    const archetype = content.archetypes.find((candidate) => candidate.id === entry.archetypeID);

    invariant(archetype, `pool entry must reference a known archetype: ${entry.archetypeID}`);

    return { value: archetype, weight: entry.weight };
  });

  const multiplier = node.difficulty * content.tuning.difficultyScalingFactor;
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
