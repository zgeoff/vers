import { randomBytes, randomInt } from 'node:crypto';
import type { CreateQAAccountInput, QAAccount } from '@vers/contract-activity';
import { createGenesisSeed } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { applyQASeed, buildPasswordFromBytes, parseQAUser } from '@vers/qa-account';
import type { Kysely } from 'kysely';
import { readAvatarKeys } from '../read-avatar-keys';
import type { KeysClient, QAAccountConflictPayload, QAAccountNameInvalidPayload } from '../types';

interface CreateQAAccountDeps {
  readonly db: Kysely<DB>;
  readonly keysClient: KeysClient;
  readonly keyVersion: number;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

interface CreateQAAccountOpts {
  readonly errors: {
    readonly CONFLICT: (payload: QAAccountConflictPayload) => Error;
    readonly QA_ACCOUNT_NAME_INVALID: (payload: QAAccountNameInvalidPayload) => Error;
  };
  readonly input: CreateQAAccountInput;
}

const PASSWORD_ENTROPY_BYTES = 20;

export async function createQAAccount(
  deps: Readonly<CreateQAAccountDeps>,
  opts: CreateQAAccountOpts,
): Promise<QAAccount> {
  const parsed = parseQAUser(opts.input.user);

  if (parsed.kind === 'refused') {
    throw opts.errors.QA_ACCOUNT_NAME_INVALID({ data: { reason: parsed.reason } });
  }

  const password =
    opts.input.password ?? buildPasswordFromBytes(randomBytes(PASSWORD_ENTROPY_BYTES));

  const outcome = await applyQASeed(
    {
      db: deps.db,
      readAvatarKeys: (avatarID) =>
        readAvatarKeys(deps.keysClient, {
          avatarID,
          keyVersion: deps.keyVersion,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        }),
    },
    {
      entropy: { genesisSeed: createGenesisSeed(), userSeed: randomInt(0, 2 ** 31) },
      keyVersion: deps.keyVersion,
      level: opts.input.level,
      now: new Date(),
      password,
      runs: opts.input.runs,
      secretRef: deps.secretRef,
      secretVersion: deps.secretVersion,
      twoFactor: opts.input.twoFactor,
      user: parsed.user,
    },
  );

  if (outcome.kind === 'exists') {
    throw opts.errors.CONFLICT({ data: { field: outcome.clash.field } });
  }

  return { ...outcome.account, password };
}
