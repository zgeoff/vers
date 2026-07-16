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
  readonly id: string;
  readonly seed: string;
}

/**
 * Overrides for {@link buildSimulationInput}'s otherwise-fixed derivation.
 */
export interface BuildSimulationInputOptions {
  readonly failureAction?: ActivityFailureAction;
}

/**
 * Builds the engine's `ActivityInput`/`AvatarData` from an activity row's stamped seed and build
 * snapshot — the only simulation inputs the current schema persists. The client and the verifier
 * both call this from the same activity row, so a stream simulates byte-identically on both sides;
 * every activity drives the same placeholder encounter and weapon until a node-content service and
 * avatar equipment persistence exist to author real ones. Returns fresh placeholder enemy/weapon
 * objects on every call: the engine mutates its input in place, so a caller running several
 * simulations from one shared literal would have them corrupt each other.
 */
export function buildSimulationInput(
  source: Readonly<SimulationInputSource>,
  options?: Readonly<BuildSimulationInputOptions>,
): { activity: ActivityInput; avatar: AvatarData } {
  return {
    activity: {
      difficulty: 1,
      enemies: [buildPlaceholderEnemy()],
      failureAction: options?.failureAction ?? ActivityFailureAction.Abort,
      id: source.id,
      name: 'World Map Encounter',
      seed: source.seed,
      type: ActivityType.WorldMapEncounter,
    },
    avatar: {
      id: source.avatarID,
      level: source.buildSnapshot.level,
      life: 200,
      name: source.avatarID,
      paperdoll: { [EquipmentSlot.MainHand]: buildPlaceholderWeapon() },
      xp: source.buildSnapshot.xp,
    },
  };
}

function buildPlaceholderEnemy() {
  return {
    level: 1,
    life: 30,
    name: 'World Map Enemy',
    primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
    xp: 10,
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
