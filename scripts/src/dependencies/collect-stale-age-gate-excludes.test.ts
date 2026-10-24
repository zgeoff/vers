import { expect, test } from 'bun:test';
import { collectStaleAgeGateExcludes } from './collect-stale-age-gate-excludes';

test('it reports an exclude whose removal date has passed', () => {
  const bunfig = [
    '[install]',
    '# left-pad 1.3.1 (published 2026-03-01, patches GHSA-aaaa-bbbb-cccc) ages past the gate ~2026-03-08 — remove then (audit-fix)',
    'minimumReleaseAgeExcludes = ["left-pad"]',
  ].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-09')).toStrictEqual([
    { entry: 'left-pad', problem: 'the age-gate exclude was due for removal on 2026-03-08' },
  ]);
});

test('it keeps an exclude on its removal date', () => {
  const bunfig = [
    '[install]',
    '# left-pad 1.3.1 (published 2026-03-01, patches GHSA-aaaa-bbbb-cccc) ages past the gate ~2026-03-08 — remove then (audit-fix)',
    'minimumReleaseAgeExcludes = ["left-pad"]',
  ].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-08')).toStrictEqual([]);
});

test('it reads a hand-written removal comment with no audit-fix marker', () => {
  const bunfig = [
    '[install]',
    '# left-pad 1.3.1 (published 2026-03-01, patches GHSA-aaaa-bbbb-cccc) ages past the gate ~2026-03-08 — remove then',
    'minimumReleaseAgeExcludes = ["left-pad"]',
  ].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-09')).toStrictEqual([
    { entry: 'left-pad', problem: 'the age-gate exclude was due for removal on 2026-03-08' },
  ]);
});

test('it reports an exclude with no removal comment', () => {
  const bunfig = ['[install]', 'minimumReleaseAgeExcludes = ["left-pad"]'].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-01')).toStrictEqual([
    { entry: 'left-pad', problem: 'the age-gate exclude has no dated removal comment' },
  ]);
});

test('it never reports a first-party exclude', () => {
  const bunfig = ['[install]', 'minimumReleaseAgeExcludes = ["@zgeoff/std"]'].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-01')).toStrictEqual([]);
});

test('it takes the latest date when two comments name one exclude', () => {
  const bunfig = [
    '[install]',
    '# left-pad 1.3.1 (published 2026-03-01, patches GHSA-aaaa-bbbb-cccc) ages past the gate ~2026-03-08 — remove then (audit-fix)',
    '# left-pad 2.0.1 (published 2026-03-05, patches GHSA-aaaa-bbbb-cccc) ages past the gate ~2026-03-12 — remove then (audit-fix)',
    'minimumReleaseAgeExcludes = ["left-pad"]',
  ].join('\n');

  expect(collectStaleAgeGateExcludes(bunfig, '2026-03-10')).toStrictEqual([]);
});

test('it reports nothing for a bunfig with no excludes', () => {
  expect(collectStaleAgeGateExcludes('[install]\nexact = true\n', '2026-03-01')).toStrictEqual([]);
});
