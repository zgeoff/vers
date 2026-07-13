import type { LiveSimulation, SimulationSnapshot } from '../../types';

export function getSnapshot(state: LiveSimulation): SimulationSnapshot {
  const combat = state.combat?.getSnapshot();
  const activity = state.activity?.getSnapshot();
  const avatar = state.avatar?.getSnapshot();

  return {
    ...(activity !== undefined && { activity }),
    ...(avatar !== undefined && { avatar }),
    ...(combat !== undefined && { combat }),
    failureAction: state.failureAction,
  };
}
