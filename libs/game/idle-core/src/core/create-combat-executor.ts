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
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): CombatExecutor {
  let elapsed = 0;
  let scheduledEvents: Array<CombatEvent> = [];

  const getAppState = (): CombatExecutorAppState => ({
    elapsed,
  });

  const scheduleEvent = (event: CombatEvent) => {
    scheduledEvents.push(event);
  };

  const processEvents = () => {
    const sortEvents = createEventSorter(avatar);

    scheduledEvents.sort(sortEvents);

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

    activity.currentWave?.enemies.forEach((enemy) => {
      enemy.handleTick(executor, ctx);
    });

    processEvents();

    activity.elapseTime(delta);
  };

  return executor;
}
