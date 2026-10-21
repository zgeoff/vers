import type * as z from 'zod';

export interface JobDef<TPayload extends object = object> {
  readonly schema: z.ZodType<TPayload>;
  readonly retryLimit?: number;
  readonly retryDelay?: number;
  readonly retryBackoff?: boolean;
  readonly deadLetter?: boolean;
  readonly expireInSeconds?: number;
}

export type JobDefs = Readonly<Record<string, JobDef>>;

export type JobPayloads = Readonly<Record<string, object>>;

export type JobDefMap<TPayloads extends JobPayloads> = {
  readonly [TName in keyof TPayloads]: JobDef<TPayloads[TName]>;
};

export type JobPayloadsOf<TDefs extends JobDefs> = {
  readonly [TName in keyof TDefs]: z.output<TDefs[TName]['schema']>;
};
