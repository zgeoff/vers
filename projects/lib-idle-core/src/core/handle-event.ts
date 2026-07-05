import type { Activity, Avatar, CombatEvent, SimulationContext } from '../types';
import { CombatEventType } from '../types';
import { handleAvatarAttack } from './handle-avatar-attack';
import { handleEnemyAttack } from './handle-enemy-attack';

export function handleEvent<T extends CombatEventType>(
  event: Extract<CombatEvent, { type: T }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  avatar: Avatar,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  activity: Activity,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: SimulationContext,
) {
  EVENT_HANDLER_FN[event.type](event, avatar, activity, ctx);
}

type EventHandlerMap = {
  [Type in CombatEventType]: (
    event: Extract<CombatEvent, { type: Type }>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    avatar: Avatar,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    activity: Activity,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    ctx: SimulationContext,
  ) => void;
};

const EVENT_HANDLER_FN: EventHandlerMap = {
  [CombatEventType.AvatarAttack]: handleAvatarAttack,
  [CombatEventType.EnemyAttack]: handleEnemyAttack,
} as const;
