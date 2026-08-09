import { MIN_DIFFICULTY, buildEncounter } from '@vers/game-utils';
import type { EncounterContent } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { buildLifeFromLevel } from '../progression';
import type { ActivityInput, AvatarData } from '../types';
import { ActivityFailureAction, ActivityType, EquipmentSlot } from '../types';

/**
 * The activity fields a simulation input is derived from — satisfied structurally by both the
 * contract `ActivityData` row and a replay segment's activity, so neither this package nor a
 * caller needs to import contract types.
 */
export interface SimulationInputSource {
  readonly avatarID: string;
  readonly buildSnapshot: { readonly level: number; readonly xp: number };
  readonly contentVersion: string;
  readonly encounterNode: { readonly difficulty: number; readonly poolID?: string | undefined };
  readonly id: string;
  readonly seed: string;
}

/**
 * Overrides for this module's otherwise-fixed derivation.
 */
export interface BuildSimulationInputOptions {
  readonly failureAction?: ActivityFailureAction;
}

/**
 * Builds the engine's `ActivityInput`/`AvatarData` from an activity row's stamped seed, content
 * version, build snapshot, and resolved encounter node. The client and the verifier both call this
 * from the same activity row, so the resolved encounter — and the stream it drives — is
 * byte-identical on both sides. Floors the node's difficulty at `MIN_DIFFICULTY` for both the
 * encounter and `activity.difficulty`, so a difficulty-0 node (the world map's unscaled origin)
 * still derives a valid encounter and reward-slot tier. Returns a fresh placeholder weapon object
 * on every call: the engine mutates its input in place, so a caller running several simulations
 * from one shared literal would have them corrupt each other.
 */
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
