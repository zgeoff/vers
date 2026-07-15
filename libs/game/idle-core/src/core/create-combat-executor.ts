import { createEventSorter } from '../core/utils/create-event-sorter';
import type {
  Activity,
  Avatar,
  CombatEvent,
  CombatExecutor,
  CombatExecutorSnapshot,
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

  const getSnapshot = (): CombatExecutorSnapshot => ({
    elapsed,
  });

  const scheduleEvent = (event: CombatEvent) => {
    scheduledEvents.push(event);
  };

  const applyEvents = () => {
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
    getSnapshot,
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

    applyEvents();

    activity.advanceTime(delta);
  };

  return executor;
}
