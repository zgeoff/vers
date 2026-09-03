import * as z from 'zod';

export const ActivityFailureActionSchema = z.enum(['abort', 'retry']);

export type ActivityFailureAction = z.infer<typeof ActivityFailureActionSchema>;
