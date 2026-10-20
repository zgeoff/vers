import { resolveTestSigningKeySet } from '../resolve-test-signing-key-set';
import { os } from './os';

export const getSigningKeys = os.getSigningKeys.handler(async () => {
  const published = await resolveTestSigningKeySet();

  return published.keySet;
});
