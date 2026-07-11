import type * as z from 'zod';

/**
 * A single job's contract: its payload shape and retry/dead-letter policy. `retryLimit` and
 * `retryDelay` are seconds-based pg-boss queue options; omitting them keeps pg-boss's own
 * defaults. `TPayload` is bound to `object` because pg-boss stores every job payload as a jsonb
 * row.
 */
export interface JobDef<TPayload extends object = object> {
  readonly schema: z.ZodType<TPayload>;
  readonly retryLimit?: number;
  readonly retryDelay?: number;
  readonly deadLetter?: boolean;
}

export type JobDefs = Readonly<Record<string, JobDef>>;
