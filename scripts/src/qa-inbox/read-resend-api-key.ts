import { readOpBackedCredential } from '../env/read-op-backed-credential';

const RESEND_CREDENTIAL = {
  envName: 'RESEND_API_KEY',
  fieldLabels: ['full-access-api-key', 'api-key'],
  itemTitle: 'resend',
  vault: 'vers',
};

export function readResendAPIKey(): Promise<string> {
  return readOpBackedCredential(RESEND_CREDENTIAL);
}
