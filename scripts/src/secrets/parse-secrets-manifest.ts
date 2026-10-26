import { z } from 'zod';
import type { SecretsManifest } from './types';

const NAME_SCHEMA = z.string().min(1);
const ITEMS_SCHEMA = z.record(NAME_SCHEMA, z.array(NAME_SCHEMA));
const SECRETS_MANIFEST_SCHEMA = z.strictObject({ vaults: z.record(NAME_SCHEMA, ITEMS_SCHEMA) });

export function parseSecretsManifest(document: unknown): z.ZodSafeParseResult<SecretsManifest> {
  return SECRETS_MANIFEST_SCHEMA.safeParse(document);
}
