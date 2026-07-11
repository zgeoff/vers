import { z } from 'zod';
import type { AppMachine, AppState } from './types';

const stringRecordSchema = z.record(z.string(), z.string());

const machineConfigSchema = z.object({
  env: stringRecordSchema.optional(),
  metadata: stringRecordSchema.optional(),
});

const machineSchema = z.object({
  id: z.string(),
  state: z.string(),
  config: machineConfigSchema.optional(),
});

const machinesSchema = z.array(machineSchema);

/**
 * Parses `flyctl machines list --json` output into the fleet view the deploy
 * pipeline reasons about. Machines outside the `app` process group (release
 * commands, builders) are dropped. `deployedSHA` is the `GIT_SHA` machine env
 * every app machine agrees on — a mixed or absent value yields null, which
 * downstream treats as "unknown, assume stale".
 */
export function parseAppState(json: unknown): AppState {
  const machines = machinesSchema
    .parse(json)
    .filter((machine) => (machine.config?.metadata?.['fly_process_group'] ?? 'app') === 'app')
    .map((machine) => ({
      id: machine.id,
      state: machine.state,
      gitSHA: machine.config?.env?.['GIT_SHA'] ?? null,
    }));

  return { deployedSHA: pickDeployedSHA(machines), machines };
}

function pickDeployedSHA(machines: ReadonlyArray<AppMachine>): string | null {
  const shas = new Set(machines.map((machine) => machine.gitSHA));

  if (shas.size !== 1) {
    return null;
  }

  return [...shas][0] ?? null;
}
