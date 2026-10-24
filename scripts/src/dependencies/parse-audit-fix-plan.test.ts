import { expect, test } from 'bun:test';
import { parseAuditFixPlan } from './parse-audit-fix-plan';

test('it lists the packages that have a fix in range, leaving out the blocked ones', () => {
  const output = JSON.stringify({
    dryRun: true,
    fixes: [{ name: 'left-pad', from: '1.3.0', to: '1.3.1', newerThanMinimumReleaseAge: false }],
    blocked: [
      {
        name: 'right-pad',
        from: '2.0.0',
        to: '3.0.1',
        blockers: [{ dependent: 'pad-tools@2.0.0', range: '2.0.0' }],
      },
    ],
    unfixable: [],
  });

  expect(parseAuditFixPlan(output)).toStrictEqual(['left-pad']);
});

test('it leaves out a package with one copy fixable in range and another blocked', () => {
  const output = JSON.stringify({
    dryRun: true,
    fixes: [{ name: 'left-pad', from: '1.3.0', to: '1.3.1', newerThanMinimumReleaseAge: false }],
    blocked: [
      {
        name: 'left-pad',
        from: '0.9.0',
        to: '1.3.1',
        blockers: [{ dependent: 'pad-tools@2.0.0', range: '0.9.0' }],
      },
    ],
    unfixable: [],
  });

  expect(parseAuditFixPlan(output)).toStrictEqual([]);
});

test('it leaves out a package with one copy that has no patched release', () => {
  const output = JSON.stringify({
    dryRun: true,
    fixes: [{ name: 'left-pad', from: '1.3.0', to: '1.3.1', newerThanMinimumReleaseAge: false }],
    blocked: [],
    unfixable: [{ name: 'left-pad' }],
  });

  expect(parseAuditFixPlan(output)).toStrictEqual([]);
});

test('it rejects a plan with no fixes list', () => {
  expect(() => parseAuditFixPlan('{ "dryRun": true, "blocked": [], "unfixable": [] }')).toThrow();
});
