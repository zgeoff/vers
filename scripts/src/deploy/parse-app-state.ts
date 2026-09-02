import { z } from 'zod';
import { isServiceMachine } from './is-service-machine';
import type { AppMachine, AppState, ScheduledMachineState } from './types';

const stringRecordSchema = z.record(z.string(), z.string()).readonly();

const machineConfigSchema = z
  .object({
    env: stringRecordSchema.optional(),
    image: z.string().optional(),
    metadata: stringRecordSchema.optional(),
    schedule: z.string().optional(),
  })
  .readonly();

const machineCheckSchema = z
  .object({
    name: z.string(),
    status: z.string(),
  })
  .readonly();

const machineSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    state: z.string(),
    checks: z.array(machineCheckSchema).readonly().optional(),
    config: machineConfigSchema.optional(),
  })
  .readonly();

type MachineRecord = z.infer<typeof machineSchema>;

const machinesSchema = z.array(machineSchema);

export function parseAppState(json: unknown): AppState {
  const records = machinesSchema.parse(json);
  const serviceRecords = records.filter((machine) => isServiceMachine(machine));

  const machines = serviceRecords.map((machine) => ({
    id: machine.id,
    state: machine.state,
    gitSHA: machine.config?.env?.['GIT_SHA'] ?? null,
    image: normalizeImage(machine.config?.image),
    checks: machine.checks ?? [],
  }));

  const scheduledMachines: ReadonlyArray<ScheduledMachineState> = records
    .filter((machine) => machine.config?.schedule !== undefined)
    .map((machine) => ({
      id: machine.id,
      name: machine.name,
      image: normalizeImage(machine.config?.image) ?? '',
    }));

  return {
    deployedSHA: pickDeployedSHA(machines),
    machines,
    scheduledMachines,
    serviceImage: pickServiceImage(serviceRecords),
  };
}

// `flyctl deploy` records a machine's image as a bare tag, while `flyctl machine run`/`update`
// append the resolved `@sha256:…` digest, so images compare with the digest stripped
function normalizeImage(image: string | undefined): string | null {
  if (image === undefined) {
    return null;
  }

  return image.split('@')[0] ?? null;
}

function pickDeployedSHA(machines: ReadonlyArray<AppMachine>): string | null {
  const shas = new Set(machines.map((machine) => machine.gitSHA));

  if (shas.size !== 1) {
    return null;
  }

  return [...shas][0] ?? null;
}

function pickServiceImage(serviceRecords: ReadonlyArray<MachineRecord>): string | null {
  const images = new Set(serviceRecords.map((machine) => normalizeImage(machine.config?.image)));

  if (images.size !== 1) {
    return null;
  }

  return [...images][0] ?? null;
}
