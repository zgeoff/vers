import { bytesToHex } from '@noble/hashes/utils.js';
import { buildMockScopeSecret } from './build-mock-scope-secret';
import { os } from './os';

export const deriveScopeSecret = os.deriveScopeSecret.handler((opts) => {
  const secret = buildMockScopeSecret(
    opts.input.avatarID,
    opts.input.secretRef,
    opts.input.secretVersion,
  );

  return { secret: bytesToHex(secret) };
});
