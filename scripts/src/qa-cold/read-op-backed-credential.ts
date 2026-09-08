import { readOpItem } from '../env/read-op-item';
import { findOpFieldValue } from '../qa-inbox/find-op-field-value';
import type { OpBackedCredential } from './types';

export async function readOpBackedCredential(credential: OpBackedCredential): Promise<string> {
  const fromEnv = process.env[credential.envName]?.trim();

  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }

  const item = await readOpItem(credential.itemTitle, credential.vault);

  const value = findOpFieldValue(item, credential.fieldLabels);

  if (value === null) {
    throw new Error(
      `op item "${credential.itemTitle}" in vault ${credential.vault} has none of the fields ${credential.fieldLabels.join(', ')}`,
    );
  }

  return value;
}
