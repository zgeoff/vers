import type * as z from 'zod';

export interface JobDef<TPayload extends object = object> {
  readonly schema: z.ZodType<TPayload>;
  readonly retryLimit?: number;
  readonly retryDelay?: number;
  readonly retryBackoff?: boolean;
  readonly deadLetter?: boolean;
}

export type JobDefs = Readonly<Record<string, JobDef>>;
