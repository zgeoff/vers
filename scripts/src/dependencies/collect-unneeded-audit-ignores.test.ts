import { expect, test } from 'bun:test';
import { collectUnneededAuditIgnores } from './collect-unneeded-audit-ignores';

test('it keeps an ignore whose advisory has no fix in range', () => {
  expect(
    collectUnneededAuditIgnores({
      ignoreIDs: ['GHSA-aaaa-bbbb-cccc'],
      advisories: [{ advisoryIDs: ['1100200', 'GHSA-aaaa-bbbb-cccc'], packageName: 'left-pad' }],
      fixablePackages: [],
    }),
  ).toStrictEqual([]);
});

test('it reports an ignore whose advisory no locked package has', () => {
  expect(
    collectUnneededAuditIgnores({
      ignoreIDs: ['GHSA-aaaa-bbbb-cccc'],
      advisories: [{ advisoryIDs: ['1100300', 'GHSA-dddd-eeee-ffff'], packageName: 'right-pad' }],
      fixablePackages: [],
    }),
  ).toStrictEqual([
    { entry: 'GHSA-aaaa-bbbb-cccc', problem: 'no locked package has the ignored advisory' },
  ]);
});

test('it reports an ignore whose package has a patched release in range', () => {
  expect(
    collectUnneededAuditIgnores({
      ignoreIDs: ['GHSA-aaaa-bbbb-cccc'],
      advisories: [{ advisoryIDs: ['1100200', 'GHSA-aaaa-bbbb-cccc'], packageName: 'left-pad' }],
      fixablePackages: ['left-pad'],
    }),
  ).toStrictEqual([
    {
      entry: 'GHSA-aaaa-bbbb-cccc',
      problem: 'bun audit fix can move left-pad to a patched release in range',
    },
  ]);
});

test('it matches an ignore that names the numeric advisory ID', () => {
  expect(
    collectUnneededAuditIgnores({
      ignoreIDs: ['1100200'],
      advisories: [{ advisoryIDs: ['1100200', 'GHSA-aaaa-bbbb-cccc'], packageName: 'left-pad' }],
      fixablePackages: [],
    }),
  ).toStrictEqual([]);
});
