import { readOpItem } from '../env/read-op-item';
import { findOpFieldValue } from './find-op-field-value';

const OP_ITEM = 'resend';
const OP_VAULT = 'vers';
const KEY_FIELD_LABELS = ['full-access-api-key', 'api-key'];

export async function readResendAPIKey(): Promise<string> {
  const fromEnv = process.env['RESEND_API_KEY']?.trim();

  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }

  const item = await readOpItem(OP_ITEM, OP_VAULT);

  const key = findOpFieldValue(item, KEY_FIELD_LABELS);

  if (key === null) {
    throw new Error(
      `op item "${OP_ITEM}" in vault ${OP_VAULT} has none of the fields ${KEY_FIELD_LABELS.join(', ')}`,
    );
  }

  return key;
}
