import * as z from 'zod';

export const EmailJobOutputSchema = z.object({ jobID: z.string() });

export type EmailJobOutput = z.infer<typeof EmailJobOutputSchema>;
