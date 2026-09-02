import * as z from 'zod';
import { EntropySourceSchema } from './entropy-source-schema';

export const CheckpointPayloadSchema = z
  .looseObject({
    chainIndex: z.int().min(0),
    entropySource: EntropySourceSchema,
    nextSeed: z.string(),
    seed: z.string(),
    time: z.number(),
    type: z.string(),
  })
  .readonly();

export type CheckpointPayload = z.infer<typeof CheckpointPayloadSchema>;
