import { readFile } from 'node:fs/promises';
import * as z from 'zod';
import type { EnvContract } from './types';

const envContractSchema = z.object({
  optional: z.array(z.string()),
  required: z.array(z.string()),
});

export async function loadEnvContract(path: string): Promise<EnvContract | null> {
  let source: string;

  try {
    source = await readFile(path, 'utf8');
  } catch {
    return null;
  }

  return envContractSchema.parse(JSON.parse(source));
}
