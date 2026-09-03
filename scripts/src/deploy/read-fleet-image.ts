import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import { isServiceMachine } from './is-service-machine';
import type { FleetImage } from './types';

const imageRefSchema = z
  .object({ digest: z.string(), registry: z.string(), repository: z.string(), tag: z.string() })
  .readonly();

type ImageRef = z.infer<typeof imageRefSchema>;

const stringRecordSchema = z.record(z.string(), z.string()).readonly();

const machineConfigSchema = z
  .object({ metadata: stringRecordSchema.optional(), schedule: z.string().optional() })
  .readonly();

const machineSchema = z
  .object({ config: machineConfigSchema.optional(), image_ref: imageRefSchema.optional() })
  .readonly();

const machinesSchema = z.array(machineSchema);

export async function readFleetImage(app: string): Promise<FleetImage | null> {
  const stdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

  const records = machinesSchema.parse(JSON.parse(stdout));

  const refs = records
    .filter((machine) => isServiceMachine(machine))
    .map((machine) => machine.image_ref)
    .filter((ref) => ref !== undefined);

  const [first] = refs;

  if (first === undefined || !refs.every((ref) => isSameImage(ref, first))) {
    return null;
  }

  return {
    digest: first.digest,
    repository: `${first.registry}/${first.repository}`,
    tag: first.tag,
  };
}

function isSameImage(a: Readonly<ImageRef>, b: Readonly<ImageRef>): boolean {
  return (
    a.registry === b.registry &&
    a.repository === b.repository &&
    a.tag === b.tag &&
    a.digest === b.digest
  );
}
