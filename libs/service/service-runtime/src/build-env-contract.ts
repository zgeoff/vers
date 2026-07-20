import type * as z from 'zod';
import { baseEnvSchema } from './base-env-schema';

export interface EnvContract {
  readonly optional: ReadonlyArray<string>;
  readonly required: ReadonlyArray<string>;
}

/**
 * Derives a service's env contract from its shape merged over the shared base schema: a key is
 * required exactly when its schema rejects an absent value, so defaults and `.optional()` land in
 * `optional` without the shape author declaring requiredness twice.
 * Both key lists are sorted, keeping the generated artifact's diff stable across regenerations.
 */
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
