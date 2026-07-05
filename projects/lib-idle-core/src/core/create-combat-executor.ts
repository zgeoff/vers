import { createEventSorter } from '../core/utils/create-event-sorter';
import type {
  Activity,
  Avatar,
  CombatEvent,
  CombatExecutor,
  CombatExecutorAppState,
  SimulationContext,
} from '../types';
import { handleEvent } from './handle-event';

export function createCombatExecutor(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- activity is mutated in place via elapseTime during the tick loop
  activity: Activity,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- avatar is mutated in place via reset during the tick loop
  avatar: Avatar,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: SimulationContext,
): CombatExecutor {
  let elapsed = 0;
  let scheduledEvents: Array<CombatEvent> = [];

  const getAppState = (): CombatExecutorAppState => ({
    elapsed,
  });

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const scheduleEvent = (event: CombatEvent) => {
    scheduledEvents.push(event);
  };

  const processEvents = () => {
    const sortEvents = createEventSorter(avatar);

    scheduledEvents.sort(sortEvents);

    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    scheduledEvents.forEach((event: CombatEvent) => {
      handleEvent(event, avatar, activity, ctx);
    });

    scheduledEvents = [];
  };

  const reset = () => {
    elapsed = 0;

    avatar.reset({ soft: true });
  };

  const executor: CombatExecutor = {
    get elapsed() {
      return elapsed;
    },
    getAppState,
    reset,
    run(delta: number) {
      run(delta);
    },
    scheduleEvent,
  };

  const run = (delta: number) => {
    elapsed += delta;

    avatar.handleTick(executor, ctx);
    // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
    activity.currentEnemyGroup?.enemies.map((enemy) => enemy.handleTick(executor, ctx));

    processEvents();

    activity.elapseTime(delta);
  };

  return executor;
}
