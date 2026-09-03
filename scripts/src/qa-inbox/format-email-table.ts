import type { ReceivedEmailSummary } from './types';

export function formatEmailTable(emails: ReadonlyArray<ReceivedEmailSummary>): string {
  const rows = emails.map((email) => ({
    createdAt: email.createdAt,
    id: email.id,
    subject: email.subject,
    to: email.to.join(', '),
  }));

  const idWidth = Math.max(0, ...rows.map((row) => row.id.length));
  const toWidth = Math.max(0, ...rows.map((row) => row.to.length));
  const createdAtWidth = Math.max(0, ...rows.map((row) => row.createdAt.length));

  return rows
    .map(
      (row) =>
        `${row.id.padEnd(idWidth)}  ${row.to.padEnd(toWidth)}  ${row.createdAt.padEnd(createdAtWidth)}  ${row.subject}`,
    )
    .join('\n');
}
