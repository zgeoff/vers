import { expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { parseSkillGateRules } from '../../../.claude/hooks/skill-gate/parse-skill-gate-rules.ts';
import { planSkillGate } from '../../../.claude/hooks/skill-gate/plan-skill-gate.ts';

async function setupTest() {
  const rulesText = await Bun.file(
    new URL('../../../.claude/skill-gate.json', import.meta.url),
  ).text();

  const parsed = parseSkillGateRules(rulesText);

  if (!parsed.ok) {
    throw new Error(`.claude/skill-gate.json ${parsed.error}`);
  }

  const skillEntries = await readdir(new URL('../../../.claude/skills/', import.meta.url), {
    withFileTypes: true,
  });

  return {
    rules: parsed.rules,
    availableSkills: skillEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  };
}

test('it names only skills the repo has', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'package.json',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).unknown,
  ).toBeEmpty();
});

test('it denies a source edit until the code-style skill is loaded', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'libs/core/utils/src/index.ts',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toStrictEqual(['code-style']);
});

test('it allows a source edit once the code-style skill is loaded', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'libs/core/utils/src/index.ts',
      loadedSkills: ['code-style'],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toBeEmpty();
});

test('it denies a test file edit until code-style, testing and project-testing are loaded', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'libs/core/utils/src/a.test.ts',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toStrictEqual(['code-style', 'testing', 'project-testing']);
});

test('it denies a test file edit with only the testing skill loaded', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'apps/web/src/routes/-game/qa-debug-hook-mount.test.tsx',
      loadedSkills: ['code-style', 'testing'],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toStrictEqual(['project-testing']);
});

test('it allows a test file edit once both testing skills and code-style are loaded', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'libs/core/utils/src/a.test.ts',
      loadedSkills: ['code-style', 'testing', 'project-testing'],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toBeEmpty();
});

test('it gates a lifecycle package on the game-lifecycle skill as well', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'services/activity/src/handlers/a.ts',
      loadedSkills: ['code-style'],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toStrictEqual(['game-lifecycle']);
});

test('it gates markdown on the docs-writing skill', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'docs/architecture/overview.md',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toStrictEqual(['docs-writing']);
});

test('it allows generated output', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'apps/web/src/styled-system/css.ts',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toBeEmpty();
});

test('it allows a file kind no gate names', async () => {
  const ctx = await setupTest();

  expect(
    planSkillGate({
      rules: ctx.rules,
      relativePath: 'package.json',
      loadedSkills: [],
      availableSkills: ctx.availableSkills,
    }).missing,
  ).toBeEmpty();
});
