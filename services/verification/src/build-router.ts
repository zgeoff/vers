import { implement } from '@orpc/server';
import { verificationContract } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createVerification } from './handlers/create-verification';
import { get2FAVerificationURI } from './handlers/get-2fa-verification-uri';
import { getVerification } from './handlers/get-verification';
import { removeVerification } from './handlers/remove-verification';
import { updateVerification } from './handlers/update-verification';
import { verifyCode } from './handlers/verify-code';

interface BuildVerificationRouterDeps {
  readonly db: Kysely<DB>;
}

export function buildVerificationRouter(deps: BuildVerificationRouterDeps) {
  const os = implement(verificationContract).$context<ServiceContext>();

  return {
    createVerification: os.createVerification.handler((opts) => createVerification(deps.db, opts)),
    deleteVerification: os.deleteVerification.handler((opts) => removeVerification(deps.db, opts)),
    get2FAVerificationURI: os.get2FAVerificationURI.handler((opts) =>
      get2FAVerificationURI(deps.db, opts),
    ),
    getVerification: os.getVerification.handler((opts) => getVerification(deps.db, opts)),
    updateVerification: os.updateVerification.handler((opts) => updateVerification(deps.db, opts)),
    verifyCode: os.verifyCode.handler((opts) => verifyCode(deps.db, opts)),
  };
}

export type VerificationRouter = ReturnType<typeof buildVerificationRouter>;
