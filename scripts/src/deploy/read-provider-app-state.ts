import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import type { ProviderAppState } from './types';

const appSchema = z.object({ Name: z.string() }).readonly();
const appsSchema = z.array(appSchema);

const machineSchema = z
  .object({ id: z.string(), image_ref: z.object({ digest: z.string() }).readonly() })
  .readonly();

const machinesSchema = z.array(machineSchema);

/**
 * Reads what exists of a per-version provider app: whether the app itself is
 * present in the org, and whether it still holds at least one machine — the
 * planner provisions a fresh machine for an app that lost its machine, not
 * just for a missing app. The first machine's id and image digest are
 * returned so the planner can detect a machine running a stale image.
 */
export async function readProviderAppState(app: string): Promise<ProviderAppState> {
  const appsStdout = await runFlyctl(['apps', 'list', '--json']);

  const apps = appsSchema.parse(JSON.parse(appsStdout));
  const exists = apps.some((candidate) => candidate.Name === app);

  if (!exists) {
    return { exists: false, hasMachine: false, machineID: null, machineImageDigest: null };
  }

  const machinesStdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

  const [machine] = machinesSchema.parse(JSON.parse(machinesStdout));

  return {
    exists: true,
    hasMachine: machine !== undefined,
    machineID: machine?.id ?? null,
    machineImageDigest: machine?.image_ref.digest ?? null,
  };
}
