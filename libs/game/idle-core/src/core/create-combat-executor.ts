import { createEventSorter } from '../core/utils/create-event-sorter';
import type {
  Activity,
  Avatar,
  CombatEvent,
  CombatExecutor,
  CombatExecutorSnapshot,
  ScheduledCombatEvent,
  SimulationContext,
} from '../types';
import { handleEvent } from './handle-event';

export function createCombatExecutor(
  activity: Activity,
  avatar: Avatar,
  ctx: SimulationContext,
): CombatExecutor {
  let elapsed = 0;
  let nextSequence = 0;
  let scheduledEvents: Array<ScheduledCombatEvent> = [];
  const sortEvents = createEventSorter(avatar);

  const getSnapshot = (): CombatExecutorSnapshot => ({
    elapsed,
  });

  // stamps a monotonic sequence number so same-time ties resolve in schedule order, independent of
  // the scan order that discovered the event this tick
  const scheduleEvent = (event: CombatEvent) => {
    scheduledEvents.push({ ...event, sequence: nextSequence++ });
  };

  const applyEvents = () => {
    if (scheduledEvents.length >= 2) {
      scheduledEvents.sort(sortEvents);
    }

    scheduledEvents.forEach((event: ScheduledCombatEvent) => {
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

    avatar.handleTick(executor);

    activity.currentWave?.enemies.forEach((enemy) => {
      enemy.handleTick(executor);
    });

    applyEvents();

    activity.advanceTime(delta);
  };

  return executor;
}
