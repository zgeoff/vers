import type { Trigger } from './types';

const TRIGGER_PATTERN = /^trigger:\s+(?<kind>release|date)\s+(?<rest>.+)$/m;

export function parseTrigger(body: string): Trigger | null {
  const match = TRIGGER_PATTERN.exec(body);

  if (!match?.groups) {
    return null;
  }

  const rest = match.groups['rest']?.trim() ?? '';

  if (match.groups['kind'] === 'date') {
    return /^\d{4}-\d{2}-\d{2}$/.test(rest) ? { date: rest, kind: 'date' } : null;
  }

  const release = /^(?<pkg>\S+)\s+>(?<version>\S+)$/.exec(rest);
  const pkg = release?.groups?.['pkg'];
  const version = release?.groups?.['version'];

  if (pkg === undefined || version === undefined) {
    return null;
  }

  return { kind: 'release', pkg, version };
}
