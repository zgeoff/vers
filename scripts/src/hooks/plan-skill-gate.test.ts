import { expect, test } from 'bun:test';
import { planSkillGate } from './plan-skill-gate';

const cwd = '/repo';

test('it denies a source edit until the code-style skill is loaded', () => {
  expect(planSkillGate(cwd, '/repo/libs/core/utils/src/index.ts', new Set())).toStrictEqual({
    kind: 'deny',
    missing: ['code-style'],
  });
});

test('it allows a source edit once the code-style skill is loaded', () => {
  expect(
    planSkillGate(cwd, '/repo/libs/core/utils/src/index.ts', new Set(['code-style'])),
  ).toStrictEqual({ kind: 'allow' });
});

test('it lists every missing skill for a test file in one verdict', () => {
  expect(planSkillGate(cwd, '/repo/libs/core/utils/src/a.test.ts', new Set())).toStrictEqual({
    kind: 'deny',
    missing: ['code-style', 'testing'],
  });
});

test('it gates a lifecycle package on the game-lifecycle skill as well', () => {
  expect(
    planSkillGate(cwd, '/repo/services/activity/src/handlers/a.ts', new Set(['code-style'])),
  ).toStrictEqual({ kind: 'deny', missing: ['game-lifecycle'] });
});

test('it gates markdown on the docs-writing skill', () => {
  expect(planSkillGate(cwd, '/repo/docs/architecture/overview.md', new Set())).toStrictEqual({
    kind: 'deny',
    missing: ['docs-writing'],
  });
});

test('it allows a file outside the project', () => {
  expect(planSkillGate(cwd, '/tmp/scratch/notes.md', new Set())).toStrictEqual({ kind: 'allow' });
});

test('it allows generated output', () => {
  expect(planSkillGate(cwd, '/repo/apps/web/src/styled-system/css.ts', new Set())).toStrictEqual({
    kind: 'allow',
  });
});

test('it allows a file kind no gate names', () => {
  expect(planSkillGate(cwd, '/repo/package.json', new Set())).toStrictEqual({ kind: 'allow' });
});
