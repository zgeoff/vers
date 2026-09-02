import * as z from 'zod';
import { CheckpointPayloadSchema } from './checkpoint-payload-schema';

export const CheckpointBatchEntrySchema = z.object({
  hash: z.string(),
  payload: CheckpointPayloadSchema,
  prevHash: z.string(),
  version: z.int().min(1),
});

export type CheckpointBatchEntry = z.infer<typeof CheckpointBatchEntrySchema>;
