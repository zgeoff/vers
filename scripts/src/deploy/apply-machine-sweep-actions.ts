import { runFlyctl } from '../utils/run-flyctl';
import type { MachineSweepTarget } from './types';

export async function applyMachineSweepActions(
  app: string,
  machines: ReadonlyArray<MachineSweepTarget>,
): Promise<void> {
  for (const machine of machines) {
    console.log(`sweeping stranded machine ${machine.id} (${machine.image ?? '-'})`);

    await runFlyctl(['machine', 'destroy', '--force', machine.id, '-a', app]);
  }
}
