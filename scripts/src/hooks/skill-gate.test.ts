import { expect, onTestFinished, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the synced skill gate hook as .claude/settings.json registers it, with auto-install off,
// against this repo's own .claude/skill-gate.json and skills.
async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'skill-gate-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  const repoDir = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/u, '');
  const hookPath = join(repoDir, '.claude/hooks/skill-gate/skill-gate.ts');

  return { directory, repoDir, hookPath };
}

test('it denies a source edit until both code-style skills are loaded', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'libs/core/utils/src/index.ts') },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`code-style\` and \`project-code-style\` skills with the Skill tool before editing ${join(ctx.repoDir, 'libs/core/utils/src/index.ts')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});

test('it allows a source edit once both code-style skills are loaded', async () => {
  const ctx = await setupTest();

  await writeFile(
    join(ctx.directory, 'transcript.jsonl'),
    [
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Skill","input":{"skill":"code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Launching skill: code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1p","name":"Skill","input":{"skill":"project-code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1p","content":"Launching skill: project-code-style"}]}}',
    ].join('\n'),
  );

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'libs/core/utils/src/index.ts') },
    }),
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
});

test('it denies a test file edit until both code-style skills, testing and project-testing are loaded', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'libs/core/utils/src/a.test.ts') },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`code-style\`, \`project-code-style\`, \`testing\` and \`project-testing\` skills with the Skill tool before editing ${join(ctx.repoDir, 'libs/core/utils/src/a.test.ts')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});

test('it denies a test file edit with only the testing skill loaded', async () => {
  const ctx = await setupTest();

  await writeFile(
    join(ctx.directory, 'transcript.jsonl'),
    [
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Skill","input":{"skill":"code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Launching skill: code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1p","name":"Skill","input":{"skill":"project-code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1p","content":"Launching skill: project-code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"Skill","input":{"skill":"testing"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_2","content":"Launching skill: testing"}]}}',
    ].join('\n'),
  );

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: {
        file_path: join(ctx.repoDir, 'apps/web/src/routes/-game/qa-debug-hook-mount.test.tsx'),
      },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`project-testing\` skill with the Skill tool before editing ${join(ctx.repoDir, 'apps/web/src/routes/-game/qa-debug-hook-mount.test.tsx')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});

test('it allows a test file edit once both testing skills and both code-style skills are loaded', async () => {
  const ctx = await setupTest();

  await writeFile(
    join(ctx.directory, 'transcript.jsonl'),
    [
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Skill","input":{"skill":"code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Launching skill: code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1p","name":"Skill","input":{"skill":"project-code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1p","content":"Launching skill: project-code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"Skill","input":{"skill":"testing"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_2","content":"Launching skill: testing"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_3","name":"Skill","input":{"skill":"project-testing"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_3","content":"Launching skill: project-testing"}]}}',
    ].join('\n'),
  );

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'libs/core/utils/src/a.test.ts') },
    }),
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
});

test('it gates a lifecycle package on the game-lifecycle skill as well', async () => {
  const ctx = await setupTest();

  await writeFile(
    join(ctx.directory, 'transcript.jsonl'),
    [
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Skill","input":{"skill":"code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"Launching skill: code-style"}]}}',
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1p","name":"Skill","input":{"skill":"project-code-style"}}]}}',
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1p","content":"Launching skill: project-code-style"}]}}',
    ].join('\n'),
  );

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'services/activity/src/handlers/a.ts') },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`game-lifecycle\` skill with the Skill tool before editing ${join(ctx.repoDir, 'services/activity/src/handlers/a.ts')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});

test('it gates markdown on the docs-writing and project-docs-writing skills', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'docs/architecture/overview.md') },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`docs-writing\` and \`project-docs-writing\` skills with the Skill tool before editing ${join(ctx.repoDir, 'docs/architecture/overview.md')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});

test('it allows generated output', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'apps/web/src/styled-system/css.ts') },
    }),
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
});

test('it allows a file kind no gate names without warning of an unknown skill', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'package.json') },
    }),
  });

  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
});

test('it gates authored source in the styled-system package', async () => {
  const ctx = await setupTest();

  await writeFile(join(ctx.directory, 'transcript.jsonl'), '');

  const result = spawnSync('bun', ['--no-install', ctx.hookPath], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'], CLAUDE_PROJECT_DIR: ctx.repoDir },
    input: JSON.stringify({
      cwd: ctx.repoDir,
      transcript_path: join(ctx.directory, 'transcript.jsonl'),
      tool_input: { file_path: join(ctx.repoDir, 'libs/design/styled-system/panda.config.ts') },
    }),
  });

  expect(result.status).toBe(0);

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Load the \`code-style\` and \`project-code-style\` skills with the Skill tool before editing ${join(ctx.repoDir, 'libs/design/styled-system/panda.config.ts')}, then retry the edit. Change a gated path only with Edit, Write or MultiEdit, never through Bash. .claude/skill-gate.json lists the skills each path needs.`,
    },
  });
});
