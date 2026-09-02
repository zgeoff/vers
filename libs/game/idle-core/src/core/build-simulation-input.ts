import { MIN_DIFFICULTY, buildEncounter } from '@vers/game-utils';
import type { EncounterContent } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { buildLifeFromLevel } from '../progression';
import type { ActivityInput, AvatarData } from '../types';
import { ActivityFailureAction, ActivityType, EquipmentSlot } from '../types';

export interface SimulationInputSource {
  readonly avatarID: string;
  readonly buildSnapshot: { readonly level: number; readonly xp: number };
  readonly contentVersion: string;
  readonly encounterNode: { readonly difficulty: number; readonly poolID?: string | undefined };
  readonly id: string;
  readonly seed: string;
}

export interface BuildSimulationInputOptions {
  readonly failureAction?: ActivityFailureAction;
}

export function buildSimulationInput(
  content: Readonly<EncounterContent>,
  source: Readonly<SimulationInputSource>,
  options?: Readonly<BuildSimulationInputOptions>,
): { activity: ActivityInput; avatar: AvatarData } {
  invariant(
    content.contentVersion === source.contentVersion,
    "content must match the source's pinned content version",
  );

  const difficulty = Math.max(source.encounterNode.difficulty, MIN_DIFFICULTY);

  const encounter = buildEncounter({
    content,
    node: {
      difficulty,
      ...(source.encounterNode.poolID !== undefined && { poolID: source.encounterNode.poolID }),
    },
    seed: source.seed,
  });

  return {
    activity: {
      difficulty,
      encounter,
      failureAction: options?.failureAction ?? ActivityFailureAction.Abort,
      id: source.id,
      name: 'World Map Encounter',
      seed: source.seed,
      type: ActivityType.WorldMapEncounter,
    },
    avatar: {
      id: source.avatarID,
      level: source.buildSnapshot.level,
      life: buildLifeFromLevel(source.buildSnapshot.level),
      name: source.avatarID,
      paperdoll: { [EquipmentSlot.MainHand]: buildPlaceholderWeapon() },
      xp: source.buildSnapshot.xp,
    },
  };
}

function buildPlaceholderWeapon() {
  return {
    id: 'placeholder_weapon',
    maxDamage: 20,
    minDamage: 10,
    name: 'Placeholder Blade',
    speed: 0.8,
  };
}
