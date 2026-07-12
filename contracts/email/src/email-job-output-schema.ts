import * as z from 'zod';

/**
 * Every send procedure's response: the pg-boss id of the delivery job it enqueued, not a
 * send-confirmation — the caller learns the outcome only by polling the queue or watching for a
 * dead-lettered job.
 */
export const EmailJobOutputSchema = z.object({ jobID: z.string() });

export type EmailJobOutput = z.infer<typeof EmailJobOutputSchema>;
