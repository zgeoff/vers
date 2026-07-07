import { implement } from '@orpc/server';
import { verificationContract } from '@vers/contract-verification';
import type { MockContext } from '../resolve-session-context';

/**
 * The mock verification service's full router. No flow in this phase reads it yet; every
 * procedure is a placeholder until its flow phase lands real business logic, per #259's scope.
 */
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
