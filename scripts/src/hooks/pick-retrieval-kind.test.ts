import { expect, test } from 'bun:test';
import { pickRetrievalKind } from './pick-retrieval-kind';
import type { RetrievalKind } from './types';

const rows: ReadonlyArray<[RetrievalKind, string, Readonly<Record<string, unknown>>]> = [
  ['search', 'Grep', { pattern: 'createSession' }],
  ['search', 'Bash', { command: 'rg -n createSession services' }],
  ['search', 'Bash', { command: 'cat a.ts | grep foo' }],
  ['search', 'Bash', { command: 'cd services && rg -l createSession' }],
  ['search', 'Bash', { command: '  grep -rn foo .' }],
  ['search', 'Bash', { command: 'git grep -n foo' }],
  ['other', 'Bash', { command: 'bun test scripts/src/hooks' }],
  ['other', 'Bash', { command: 'echo agrep' }],
  ['other', 'Bash', { command: 'echo grep foo' }],
  ['read-whole', 'Read', { file_path: '/repo/services/session/src/a.ts' }],
  ['read-ranged', 'Read', { file_path: '/repo/services/session/src/a.ts', offset: 10 }],
  ['read-ranged', 'Read', { file_path: '/repo/services/session/src/a.tsx', limit: 40 }],
  ['other', 'Read', { file_path: '/repo/docs/architecture/overview.md' }],
  ['other', 'Read', { file_path: '/repo/package.json' }],
  ['edit', 'Edit', { file_path: '/repo/services/session/src/a.ts' }],
  ['edit', 'Write', { file_path: '/repo/apps/web/src/b.tsx' }],
  ['other', 'Write', { file_path: '/repo/docs/plan.md' }],
  ['symbol-lookup', 'mcp__serena__find_symbol', {}],
  ['symbol-lookup', 'mcp__serena__get_symbols_overview', {}],
  ['other', 'mcp__serena__initial_instructions', {}],
  ['other', 'Glob', { pattern: '**/*.ts' }],
  ['other', 'Skill', { skill: 'testing' }],
];

test.each(rows)('it picks %s for a %s call with %j', (expected, toolName, toolInput) => {
  expect(pickRetrievalKind(toolName, toolInput)).toBe(expected);
});
