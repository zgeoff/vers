import { expect, test } from 'bun:test';
import { parseAuditReport } from './parse-audit-report';

test('it lists each advisory under both of its IDs', () => {
  const output = JSON.stringify({
    'left-pad': [
      {
        id: 1_100_200,
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
        title: 'Unbounded padding',
        severity: 'high',
        vulnerable_versions: '<1.3.1',
      },
    ],
  });

  expect(parseAuditReport(output)).toStrictEqual([
    { advisoryIDs: ['1100200', 'GHSA-aaaa-bbbb-cccc'], packageName: 'left-pad' },
  ]);
});

test('it reads an empty report as no advisories', () => {
  expect(parseAuditReport('{}')).toStrictEqual([]);
});

test('it rejects an advisory with no ID', () => {
  const output = JSON.stringify({
    'left-pad': [{ url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }],
  });

  expect(() => parseAuditReport(output)).toThrow();
});
