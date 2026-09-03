import type { ReceivedEmailSummary } from './types';

interface MatchConfig {
  readonly since: Date;
  readonly to: string;
}

export function collectMatchingEmails(
  emails: ReadonlyArray<ReceivedEmailSummary>,
  config: MatchConfig,
): Array<ReceivedEmailSummary> {
  const address = config.to.trim().toLowerCase();

  return emails
    .filter(
      (email) =>
        email.to.some((recipient) => recipient.trim().toLowerCase() === address) &&
        new Date(email.createdAt).getTime() >= config.since.getTime(),
    )
    .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
