import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';

const appSchema = z.object({ Name: z.string() }).readonly();
const appsSchema = z.array(appSchema);

/**
 * True when a Fly app with this name already exists in the org — the
 * sim-version planner's signal for whether a per-version provider app still
 * needs creating.
 */
export async function readProviderAppExists(app: string): Promise<boolean> {
  const stdout = await runFlyctl(['apps', 'list', '--json']);

  const apps = appsSchema.parse(JSON.parse(stdout));

  return apps.some((candidate) => candidate.Name === app);
}
