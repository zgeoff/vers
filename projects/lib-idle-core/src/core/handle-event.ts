import type { Activity, Avatar, CombatEvent, SimulationContext } from '../types';
import { CombatEventType } from '../types';
import { handleAvatarAttack } from './handle-avatar-attack';
import { handleEnemyAttack } from './handle-enemy-attack';

export function handleEvent<T extends CombatEventType>(
  event: Extract<CombatEvent, { type: T }>,
  avatar: Avatar,
  activity: Activity,
  ctx: SimulationContext,
) {
  EVENT_HANDLER_FN[event.type](event, avatar, activity, ctx);
}

type EventHandlerMap = {
  [Type in CombatEventType]: (
    event: Extract<CombatEvent, { type: Type }>,
    avatar: Avatar,
    activity: Activity,
    ctx: SimulationContext,
  ) => void;
};

const EVENT_HANDLER_FN: EventHandlerMap = {
  [CombatEventType.AvatarAttack]: handleAvatarAttack,
  [CombatEventType.EnemyAttack]: handleEnemyAttack,
} as const;
