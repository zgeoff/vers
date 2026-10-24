import { z } from 'zod';
import type { CheckpointRow } from './types';

const CheckpointLineSchema = z.object({
  activityId: z.string(),
  appendedAt: z.iso.datetime().transform((value) => new Date(value)),
  hash: z.string(),
  payload: z.json(),
  prevHash: z.string(),
  version: z.int(),
});

export function parseCheckpointArchive(archive: Uint8Array<ArrayBuffer>): Array<CheckpointRow> {
  const text = new TextDecoder().decode(Bun.gunzipSync(archive));

  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => CheckpointLineSchema.parse(JSON.parse(line)));
}
