import { runFlyctl } from '../utils/run-flyctl';
import { parseFlyMachines } from './parse-fly-machines';
import type { MachineFleet } from './types';

export function createFlyMachineFleet(app: string): MachineFleet {
  return {
    list: async () => {
      const stdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

      const json: unknown = JSON.parse(stdout);

      return parseFlyMachines(json);
    },
    start: async (id) => {
      await runFlyctl(['machine', 'start', id, '--app', app]);
    },
  };
}
