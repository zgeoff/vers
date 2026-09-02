import { expect, test } from 'bun:test';
import { collectDocPaths } from './collect-doc-paths';

test('it collects a rooted path named in prose', () => {
  const markdown = 'Read `docs/architecture/game/seed-chain.md` first.';

  expect(collectDocPaths(markdown, 'AGENTS.md')).toStrictEqual([
    { line: 1, path: 'docs/architecture/game/seed-chain.md' },
  ]);
});

test('it resolves a relative link against the document directory', () => {
  const markdown = 'See [replay](../services/error-handling.md#taxonomy).';

  expect(collectDocPaths(markdown, 'docs/architecture/game/game-simulation.md')).toStrictEqual([
    { line: 1, path: 'docs/architecture/services/error-handling.md' },
  ]);
});

test('it drops the sentence period a trailing path picks up', () => {
  const markdown = 'The check lives in scripts/src/issue-hygiene/check-issue.ts.';

  expect(collectDocPaths(markdown, 'docs/README.md')).toStrictEqual([
    { line: 1, path: 'scripts/src/issue-hygiene/check-issue.ts' },
  ]);
});

test('it skips a placeholder, a glob, and an env file', () => {
  const markdown = [
    'Run `git worktree add .worktrees/<branch>`.',
    'Setters live in `libs/game/idle-client/src/state/set-*.ts`.',
    'Pull `apps/web/.env` with env:pull.',
  ].join('\n');

  expect(collectDocPaths(markdown, 'AGENTS.md')).toStrictEqual([]);
});

test('it skips a bare file name and a package name', () => {
  const markdown = 'Rename `with-jest-context.ts`; `@vers/utils` is `libs/core/utils`.';

  expect(collectDocPaths(markdown, 'AGENTS.md')).toStrictEqual([
    { line: 1, path: 'libs/core/utils' },
  ]);
});

test('it reports the line that names each path', () => {
  const markdown = ['intro', '', '- `services/activity`', '- `services/replay`'].join('\n');

  expect(collectDocPaths(markdown, 'docs/README.md')).toStrictEqual([
    { line: 3, path: 'services/activity' },
    { line: 4, path: 'services/replay' },
  ]);
});
