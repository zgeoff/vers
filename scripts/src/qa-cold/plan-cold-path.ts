import type { AppMachine } from '../deploy/types';
import { isColdMachine } from './is-cold-machine';
import type { AutoStopMode, ColdPathAction } from './types';

export function planColdPath(
  app: string,
  machines: ReadonlyArray<AppMachine>,
  mode: AutoStopMode,
): Array<ColdPathAction> {
  return machines
    .filter((machine) => !isColdMachine(machine))
    .map((machine) => ({ app, kind: mode, machineID: machine.id }));
}
