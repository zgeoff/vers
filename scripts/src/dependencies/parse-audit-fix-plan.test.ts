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

test('it rejects a plan with no fixes list', () => {
  expect(() => parseAuditFixPlan('{ "dryRun": true }')).toThrow();
});
