import { z } from 'zod';
import type { FlyMachine } from './types';

const machinesSchema = z.array(z.object({ id: z.string(), state: z.string() }));

export function parseFlyMachines(json: unknown): ReadonlyArray<FlyMachine> {
  return machinesSchema.parse(json).map((machine) => ({ id: machine.id, state: machine.state }));
}
