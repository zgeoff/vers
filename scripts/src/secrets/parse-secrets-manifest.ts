import { map as mapSchema, z } from 'zod';
import type { SecretsManifest } from './types';

const NAME_SCHEMA = z.string().min(1);

// zod's record parse drops a `__proto__` key unseen, and a plain object finds `constructor` on its
// prototype, so each name table is read from its own entries into a map
const ITEMS_SCHEMA = z.preprocess(
  (value) => toOwnEntryMap(value),
  mapSchema(NAME_SCHEMA, z.array(NAME_SCHEMA)),
);

const SECRETS_MANIFEST_SCHEMA = z.strictObject({
  vaults: z.preprocess((value) => toOwnEntryMap(value), mapSchema(NAME_SCHEMA, ITEMS_SCHEMA)),
});

export function parseSecretsManifest(document: unknown): z.ZodSafeParseResult<SecretsManifest> {
  return SECRETS_MANIFEST_SCHEMA.safeParse(document);
}

function toOwnEntryMap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? new Map(Object.entries(value))
    : value;
}
