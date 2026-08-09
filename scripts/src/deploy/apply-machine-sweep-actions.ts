import { runFlyctl } from '../utils/run-flyctl';
import type { MachineSweepTarget } from './types';

/**
 * Destroys each stranded machine the planner found outside the fleet's kept image group,
 * sequentially, logging each one before the destroy so the sweep's output shows what it acted on.
 */
export async function applyMachineSweepActions(
  app: string,
  machines: ReadonlyArray<MachineSweepTarget>,
): Promise<void> {
  for (const machine of machines) {
    console.log(`sweeping stranded machine ${machine.id} (${machine.image ?? '-'})`);

    await runFlyctl(['machine', 'destroy', '--force', machine.id, '-a', app]);
  }
}
