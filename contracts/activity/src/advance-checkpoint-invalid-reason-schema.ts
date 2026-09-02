import * as z from 'zod';
import { CheckpointInvalidReasonSchema } from './checkpoint-invalid-reason-schema';

export const AdvanceCheckpointInvalidReasonSchema = z.enum([
  ...CheckpointInvalidReasonSchema.options,
  'build-snapshot-mismatch',
  'continuation-not-terminal',
  'start-hash-mismatch',
]);

export type AdvanceCheckpointInvalidReason = z.infer<typeof AdvanceCheckpointInvalidReasonSchema>;
