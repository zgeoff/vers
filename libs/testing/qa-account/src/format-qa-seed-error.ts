import { ORPCError, isDefinedError } from '@orpc/client';
import type { ErrorFromErrorMap } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import { match } from 'ts-pattern';

type CreateQAAccountError = ErrorFromErrorMap<
  (typeof activityContract.createQAAccount)['~orpc']['errorMap']
>;

interface QASeedErrorContext {
  readonly host: string;
  readonly user: string;
}

export function formatQASeedError(
  error: CreateQAAccountError,
  context: Readonly<QASeedErrorContext>,
): string {
  if (isDefinedError(error)) {
    return match(error)
      .with(
        { code: 'CONFLICT' },
        (conflict) =>
          `${conflict.data.email} already exists; run qa:reset --user ${context.user} --all first`,
      )
      .with({ code: 'QA_ACCOUNT_NAME_INVALID' }, (invalid) => invalid.data.reason)
      .exhaustive();
  }

  if (error instanceof ORPCError) {
    return match(error.status)
      .with(401, () => `${context.host} refused QA_SEED_TOKEN`)
      .with(404, () => `${context.host} has QA seeding switched off`)
      .otherwise(() => `${context.host} answered ${error.status}: ${error.message}`);
  }

  return error.message;
}
