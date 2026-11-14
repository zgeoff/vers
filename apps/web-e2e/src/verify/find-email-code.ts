import { findVerification } from '@vers/scripts';

interface CapturedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

// The last captured email decides: an older one to the same address holds a stale code.
export function findEmailCode(
  emails: ReadonlyArray<CapturedEmail>,
): { subject: string; code: string } | null {
  const last = emails.at(-1);

  if (last === undefined) {
    return null;
  }

  const code = findVerification(last, 'any')?.code ?? null;

  return code === null ? null : { subject: last.subject, code };
}
