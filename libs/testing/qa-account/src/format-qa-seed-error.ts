import { ORPCError, isDefinedError } from '@orpc/client';
import type { ErrorFromErrorMap } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import { match } from 'ts-pattern';
import { formatQAUserRefusal } from './format-qa-user-refusal';
import type { QASeedClash, QAUser } from './types';

type CreateQAAccountError = ErrorFromErrorMap<
  (typeof activityContract.createQAAccount)['~orpc']['errorMap']
>;

interface QASeedErrorContext {
  readonly host: string;
  readonly user: QAUser;
}

export function formatQASeedError(
  error: CreateQAAccountError,
  context: Readonly<QASeedErrorContext>,
): string {
  if (isDefinedError(error)) {
    return match(error)
      .with({ code: 'CONFLICT' }, (conflict) => formatConflict(conflict.data.field, context.user))
      .with(
        { code: 'FORBIDDEN' },
        () => `${context.host} forwarded the call without the QA seeding scope`,
      )
      .with({ code: 'QA_ACCOUNT_NAME_INVALID' }, (invalid) =>
        formatQAUserRefusal(context.user.name, invalid.data.reason),
      )
      .exhaustive();
  }

  if (error instanceof ORPCError) {
    return (
      match(error.status)
        .with(401, () => `${context.host} refused QA_SEED_TOKEN`)
        .with(404, () => `${context.host} has QA seeding switched off`)

        // the edge gives up on a slow seed while the activity service can still commit it
        .with(
          503,
          () =>
            `${context.host} answered 503; the account may still have been created, so rerun once: a CONFLICT on the email means it was`,
        )
        .otherwise(() => `${context.host} answered ${error.status}: ${error.message}`)
    );
  }

  return error.message;
}

function formatConflict(field: QASeedClash['field'], user: QAUser): string {
  return match(field)
    .with(
      'email',
      () => `${user.email} already exists; run qa:reset --user ${user.name} --all first`,
    )
    .with('username', () => formatNameConflict('username', user.username))
    .with('avatarName', () => formatNameConflict('avatar name', user.avatarName))
    .exhaustive();
}

function formatNameConflict(label: string, value: string): string {
  return `another account holds the ${label} ${value}; pick another --user`;
}
