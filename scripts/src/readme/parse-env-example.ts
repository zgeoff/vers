import type { EnvRow } from './types';

/**
 * Reads `KEY=` lines and the `#` comment block directly above each as that variable's
 * description. A blank line closes a comment block, so a file-leading banner describes the file,
 * not the first variable.
 */
export function parseEnvExample(text: string): Array<EnvRow> {
  const rows: Array<EnvRow> = [];
  let pendingComment: Array<string> = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '') {
      pendingComment = [];
      continue;
    }

    if (trimmed.startsWith('#')) {
      pendingComment.push(trimmed.replace(/^#\s?/, ''));
      continue;
    }

    const key = /^(?<key>[A-Z][A-Z0-9_]*)=/.exec(trimmed)?.groups?.['key'];

    if (key !== undefined) {
      rows.push({
        description: pendingComment.join(' '),
        key,
        required: true,
      });
    }

    pendingComment = [];
  }

  return rows.toSorted((a, b) => a.key.localeCompare(b.key));
}
