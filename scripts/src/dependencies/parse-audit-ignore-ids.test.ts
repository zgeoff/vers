import { expect, test } from 'bun:test';
import { parseAuditIgnoreIDs } from './parse-audit-ignore-ids';

test('it lists every advisory the audit script ignores', () => {
  expect(
    parseAuditIgnoreIDs(
      'bun audit --ignore=GHSA-aaaa-bbbb-cccc --ignore 1100200 --audit-level=high',
    ),
  ).toStrictEqual(['GHSA-aaaa-bbbb-cccc', '1100200']);
});

test('it reads an audit script with no ignores as none', () => {
  expect(parseAuditIgnoreIDs('bun audit')).toStrictEqual([]);
});
