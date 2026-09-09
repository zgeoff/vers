import { buildTestSigningKeySet } from '../build-test-signing-key-set';
import { os } from './os';

export const getSigningKeys = os.getSigningKeys.handler(async () => {
  const published = await buildTestSigningKeySet();

  return published.keySet;
});
