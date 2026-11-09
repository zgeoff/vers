import type { QAAccountNameInvalidReason } from '@vers/contract-activity';
import { match } from 'ts-pattern';
import { QA_DOMAIN } from './parse-qa-user';

export function formatQAUserRefusal(raw: string, reason: QAAccountNameInvalidReason): string {
  return match(reason)
    .with(
      'outside-qa-domain',
      () => `refusing "${raw}": only addresses under ${QA_DOMAIN} are QA accounts`,
    )
    .with(
      'invalid-name',
      () =>
        `invalid QA account name "${raw}": use letters, digits, ".", "_", "+" or "-", starting with a letter or digit`,
    )
    .with(
      'invalid-avatar-name',
      () => `the QA account name "${raw}" yields no valid avatar name; pick another --user`,
    )
    .with(
      'invalid-username',
      () => `the QA account name "${raw}" yields no valid username; pick another --user`,
    )
    .exhaustive();
}
