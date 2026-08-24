import { expect, test } from 'bun:test';
import { collectScopePaths } from './collect-scope-paths';

test('it collects a path under a source root', () => {
  const body = '## Scope\n\n- rewrite `services/activity/src/handlers/mint-activity-start.ts`';

  expect(collectScopePaths(body)).toStrictEqual([
    'services/activity/src/handlers/mint-activity-start.ts',
  ]);
});

test('it collects a bare file name carrying a source extension', () => {
  const body = '## Scope\n\n- retire `mint-root.ts`';

  expect(collectScopePaths(body)).toStrictEqual(['mint-root.ts']);
});

test('it collects a directory under a source root', () => {
  const body = '## Scope\n\n- move the store under `libs/game/idle-client/src/submission/`';

  expect(collectScopePaths(body)).toStrictEqual(['libs/game/idle-client/src/submission/']);
});

test('it drops the sentence period a trailing path picks up', () => {
  const body = '## Scope\n\n- the check lives in scripts/src/issue-hygiene/check-issue.ts.';

  expect(collectScopePaths(body)).toStrictEqual(['scripts/src/issue-hygiene/check-issue.ts']);
});

test('it reports one path once however often the scope names it', () => {
  const body = '## Scope\n\n- read `mint-root.ts`\n- then delete `mint-root.ts`';

  expect(collectScopePaths(body)).toStrictEqual(['mint-root.ts']);
});

test('it leaves a documentation path alone', () => {
  const body = '## Scope\n\n- rewrite `docs/architecture/game/seed-chain.md`';

  expect(collectScopePaths(body)).toStrictEqual([]);
});

test('it ignores a path outside the scope section', () => {
  const body = '## Scope\n\n- refuse the start\n\n## Notes\n\n- `services/activity/src/index.ts`';

  expect(collectScopePaths(body)).toStrictEqual([]);
});

test('it ignores a path in a body with no scope section', () => {
  expect(collectScopePaths('## Notes\n\n- `mint-root.ts`')).toStrictEqual([]);
});

test('it collects nothing from a scope stating outcomes alone', () => {
  const body = '## Scope\n\n- the server refuses a start whose anchor moved on';

  expect(collectScopePaths(body)).toStrictEqual([]);
});

test('it leaves a source file under the documentation root alone', () => {
  expect(collectScopePaths('## Scope\n\n- edit `docs/example.ts`')).toStrictEqual([]);
});

test('it leaves a workflow file alone', () => {
  const body = '## Scope\n\n- edit `.github/workflows/issue-hygiene.yml`';

  expect(collectScopePaths(body)).toStrictEqual([]);
});

test('it leaves a documentation config file alone', () => {
  expect(collectScopePaths('## Scope\n\n- edit `docs/reference/config.yaml`')).toStrictEqual([]);
});

test('it does not match a source root inside a longer word', () => {
  expect(collectScopePaths('## Scope\n\n- move the webapps/thing folder')).toStrictEqual([]);
});
