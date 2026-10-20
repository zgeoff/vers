import { z } from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import { isServiceMachine } from './is-service-machine';
import type { FleetImage } from './types';

const imageRefSchema = z
  .object({ digest: z.string(), registry: z.string(), repository: z.string(), tag: z.string() })
  .readonly();

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

type ImageRef = z.infer<typeof imageRefSchema>;

function isSameImage(left: Readonly<ImageRef>, right: Readonly<ImageRef>): boolean {
  return (
    left.registry === right.registry &&
    left.repository === right.repository &&
    left.tag === right.tag &&
    left.digest === right.digest
  );
}
