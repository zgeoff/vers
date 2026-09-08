import { findOpFieldValue } from './find-op-field-value';
import { readOpItem } from './read-op-item';
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
