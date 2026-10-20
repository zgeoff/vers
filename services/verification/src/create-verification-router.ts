import { implement } from '@orpc/server';
import { verificationContract } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { ServiceContext } from '@vers/service-runtime';
import type { Kysely } from 'kysely';
import { createVerification } from './handlers/create-verification';
import { read2FAVerificationURI } from './handlers/read-2fa-verification-uri';
import { readVerification } from './handlers/read-verification';
import { removeVerification } from './handlers/remove-verification';
import { updateVerification } from './handlers/update-verification';
import { verifyCode } from './handlers/verify-code';

interface CreateVerificationRouterDeps {
  readonly db: Kysely<DB>;
}

export function createVerificationRouter(deps: CreateVerificationRouterDeps) {
  const os = implement(verificationContract).$context<ServiceContext>();

  return {
    createVerification: os.createVerification.handler((opts) => createVerification(deps.db, opts)),
    deleteVerification: os.deleteVerification.handler((opts) => removeVerification(deps.db, opts)),
    get2FAVerificationURI: os.get2FAVerificationURI.handler((opts) =>
      read2FAVerificationURI(deps.db, opts),
    ),
    getVerification: os.getVerification.handler((opts) => readVerification(deps.db, opts)),
    updateVerification: os.updateVerification.handler((opts) => updateVerification(deps.db, opts)),
    verifyCode: os.verifyCode.handler((opts) => verifyCode(deps.db, opts)),
  };
}

export type VerificationRouter = ReturnType<typeof createVerificationRouter>;
