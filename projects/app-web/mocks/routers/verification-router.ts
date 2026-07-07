import { implement } from '@orpc/server';
import { verificationContract } from '@vers/contract-verification';
import type { MockContext } from '../resolve-session-context';

export function buildMockVerificationRouter() {
  const os = implement(verificationContract).$context<MockContext>();

  return {
    createVerification: os.createVerification.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    deleteVerification: os.deleteVerification.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    get2FAVerificationURI: os.get2FAVerificationURI.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    getVerification: os.getVerification.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    updateVerification: os.updateVerification.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    verifyCode: os.verifyCode.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
  };
}
