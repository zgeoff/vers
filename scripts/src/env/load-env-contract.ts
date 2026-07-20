import { readFile } from 'node:fs/promises';
import * as z from 'zod';
import type { EnvContract } from './types';

const envContractSchema = z.object({
  optional: z.array(z.string()),
  required: z.array(z.string()),
});

/**
 * Loads a generated `env-contract.generated.json`, returning null when the path has none — the
 * marker distinguishing services with an env contract from apps without one.
 */
export async function loadEnvContract(path: string): Promise<EnvContract | null> {
  let source: string;

  try {
    source = await readFile(path, 'utf8');
  } catch {
    return null;
  }

  return envContractSchema.parse(JSON.parse(source));
}
