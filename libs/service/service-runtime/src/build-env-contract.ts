import type * as z from 'zod';
import { baseEnvSchema } from './base-env-schema';

export interface EnvContract {
  readonly optional: ReadonlyArray<string>;
  readonly required: ReadonlyArray<string>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ZodType-bearing shape; zod schemas have no readonly form
export function buildEnvContract(envShape: z.ZodRawShape): EnvContract {
  const merged: Readonly<Record<string, z.ZodType>> = { ...baseEnvSchema.shape, ...envShape };
  const optional: Array<string> = [];
  const required: Array<string> = [];

  for (const key of Object.keys(merged).toSorted()) {
    const schema = merged[key];

    if (schema === undefined) {
      continue;
    }

    (schema.safeParse(undefined).success ? optional : required).push(key);
  }

  return { optional, required };
}
