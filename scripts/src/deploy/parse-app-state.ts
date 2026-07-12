import { z } from 'zod';
import type { AppMachine, AppState, ScheduledMachineState } from './types';

const stringRecordSchema = z.record(z.string(), z.string());

const machineConfigSchema = z.object({
  env: stringRecordSchema.optional(),
  image: z.string().optional(),
  metadata: stringRecordSchema.optional(),
  schedule: z.string().optional(),
});

const machineSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  config: machineConfigSchema.optional(),
});

type MachineRecord = z.infer<typeof machineSchema>;

const machinesSchema = z.array(machineSchema);

/**
 * Parses `flyctl machines list --json` output into the fleet view the deploy
 * pipeline reasons about. A scheduled machine (`config.schedule` set) is
 * never a service machine, regardless of its process-group metadata — it
 * carries neither, since it's created by `fly machine run --schedule` rather
 * than `fly deploy`. `deployedSHA` and `serviceImage` are the `GIT_SHA` env
 * and image every service machine agrees on — a mixed or absent value yields
 * null, which downstream treats as "unknown, assume stale".
 */
export function parseAppState(json: unknown): AppState {
  const records = machinesSchema.parse(json);
  const serviceRecords = records.filter((machine) => isServiceMachine(machine));

  const machines = serviceRecords.map((machine) => ({
    id: machine.id,
    state: machine.state,
    gitSHA: machine.config?.env?.['GIT_SHA'] ?? null,
  }));

  const scheduledMachines: ReadonlyArray<ScheduledMachineState> = records
    .filter((machine) => machine.config?.schedule !== undefined)
    .map((machine) => ({
      id: machine.id,
      name: machine.name,
      image: machine.config?.image ?? '',
    }));

  return {
    deployedSHA: pickDeployedSHA(machines),
    machines,
    scheduledMachines,
    serviceImage: pickServiceImage(serviceRecords),
  };
}

/**
 * A machine outside the `app` process group (release commands, builders) is
 * never a service machine either — its process group is always stamped
 * explicitly, unlike a bare app machine's, so the default only applies there.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- z.infer of the machine-list row schema, a ZodType-bearing shape with no readonly form
function isServiceMachine(machine: MachineRecord): boolean {
  return (
    machine.config?.schedule === undefined &&
    (machine.config?.metadata?.['fly_process_group'] ?? 'app') === 'app'
  );
}

function pickDeployedSHA(machines: ReadonlyArray<AppMachine>): string | null {
  const shas = new Set(machines.map((machine) => machine.gitSHA));

  if (shas.size !== 1) {
    return null;
  }

  return [...shas][0] ?? null;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- z.infer of the machine-list row schema, a ZodType-bearing shape with no readonly form
function pickServiceImage(serviceRecords: ReadonlyArray<MachineRecord>): string | null {
  const images = new Set(serviceRecords.map((machine) => machine.config?.image ?? null));

  if (images.size !== 1) {
    return null;
  }

  return [...images][0] ?? null;
}
