import type { RestoreDrillCheck } from './types';

export function formatRestoreDrillReport(checks: ReadonlyArray<RestoreDrillCheck>): string {
  const failed = checks.filter((check) => check.violations.length > 0);
  const lines = checks.flatMap((check) => formatCheck(check));

  const verdict =
    failed.length === 0
      ? `PASS: ${checks.length} of ${checks.length} checks hold`
      : `FAIL: ${failed.length} of ${checks.length} checks broken`;

  return [...lines, verdict].join('\n');
}

const LISTED_VIOLATIONS_PER_CHECK = 10;

function formatCheck(check: Readonly<RestoreDrillCheck>): Array<string> {
  const heading = `${check.violations.length === 0 ? 'ok  ' : 'FAIL'} ${check.area}: ${check.name}`;

  if (check.violations.length === 0) {
    return [heading];
  }

  const listed = check.violations.slice(0, LISTED_VIOLATIONS_PER_CHECK).map((key) => `     ${key}`);
  const unlisted = check.violations.length - listed.length;

  return [
    `${heading} (${check.violations.length})`,
    ...listed,
    ...(unlisted > 0 ? [`     and ${unlisted} more`] : []),
  ];
}
