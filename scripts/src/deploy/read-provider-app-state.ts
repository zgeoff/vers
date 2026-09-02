import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import type { ProviderAppState } from './types';

const appSchema = z.object({ Name: z.string() }).readonly();
const appsSchema = z.array(appSchema);

// image_ref can be absent while a machine is in a transient state (created, replacing); a missing
// digest reads as not-current downstream, so the machine is replaced rather than the parse failing
const machineSchema = z
  .object({
    id: z.string(),
    image_ref: z.object({ digest: z.string() }).readonly().optional(),
    region: z.string(),
  })
  .readonly();

const machinesSchema = z.array(machineSchema);

export async function readProviderAppState(app: string): Promise<ProviderAppState> {
  const appsStdout = await runFlyctl(['apps', 'list', '--json']);

  const apps = appsSchema.parse(JSON.parse(appsStdout));
  const exists = apps.some((candidate) => candidate.Name === app);

  if (!exists) {
    return {
      exists: false,
      hasMachine: false,
      machineID: null,
      machineImageDigest: null,
      machineRegion: null,
    };
  }

  const machinesStdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

  const [machine] = machinesSchema.parse(JSON.parse(machinesStdout));

  return {
    exists: true,
    hasMachine: machine !== undefined,
    machineID: machine?.id ?? null,
    machineImageDigest: machine?.image_ref?.digest ?? null,
    machineRegion: machine?.region ?? null,
  };
}
