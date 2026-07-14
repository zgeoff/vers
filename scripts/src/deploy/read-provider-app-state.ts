import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import type { ProviderAppState } from './types';

const appSchema = z.object({ Name: z.string() }).readonly();
const appsSchema = z.array(appSchema);
const machinesSchema = z.array(z.unknown());

/**
 * Reads what exists of a per-version provider app: whether the app itself is
 * present in the org, and whether it still holds at least one machine — the
 * planner provisions a fresh machine for an app that lost its machine, not
 * just for a missing app.
 */
export async function readProviderAppState(app: string): Promise<ProviderAppState> {
  const appsStdout = await runFlyctl(['apps', 'list', '--json']);

  const apps = appsSchema.parse(JSON.parse(appsStdout));
  const exists = apps.some((candidate) => candidate.Name === app);

  if (!exists) {
    return { exists: false, hasMachine: false };
  }

  const machinesStdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

  const machines = machinesSchema.parse(JSON.parse(machinesStdout));

  return { exists: true, hasMachine: machines.length > 0 };
}
