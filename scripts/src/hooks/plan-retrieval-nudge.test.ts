import { expect, test } from 'bun:test';
import { INITIAL_RETRIEVAL_STATE, planRetrievalNudge } from './plan-retrieval-nudge';
import type { RetrievalCall, RetrievalState } from './types';

interface Recording {
  readonly state: RetrievalState;
  readonly fired: ReadonlyArray<number>;
}

// A recorder that threads the planner's state through a sequence of calls one millisecond apart
// and keeps the index of every call that produced a nudge.
function setupTest() {
  let state = INITIAL_RETRIEVAL_STATE;
  let index = 0;
  const fired: Array<number> = [];

  return {
    run(...calls: ReadonlyArray<RetrievalCall>): Recording {
      for (const call of calls) {
        const plan = planRetrievalNudge(state, call, 1_000_000 + index);

        state = plan.state;

        if (plan.nudge !== null) {
          fired.push(index);
        }

        index += 1;
      }

      return { state, fired: [...fired] };
    },
  };
}

test('it stays silent in the research phase for any run of searches and reads', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/a.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/b.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/c.ts' }, permissionMode: 'default' },
  );

  expect(recording).toMatchObject({ state: { phase: 'research' }, fired: [] });
});

test('it nudges in the research phase after three symbol lookups with no read between', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'mcp__serena__find_symbol',
      toolInput: { name_path_pattern: 'a' },
      permissionMode: 'default',
    },
    {
      toolName: 'mcp__serena__find_symbol',
      toolInput: { name_path_pattern: 'b' },
      permissionMode: 'default',
    },
    {
      toolName: 'Read',
      toolInput: { file_path: '/repo/src/a.ts', offset: 10, limit: 40 },
      permissionMode: 'default',
    },
    {
      toolName: 'mcp__serena__find_symbol',
      toolInput: { name_path_pattern: 'c' },
      permissionMode: 'default',
    },
    {
      toolName: 'mcp__serena__get_symbols_overview',
      toolInput: { relative_path: 'src/a.ts' },
      permissionMode: 'default',
    },
    {
      toolName: 'mcp__serena__find_referencing_symbols',
      toolInput: { name_path_pattern: 'c' },
      permissionMode: 'default',
    },
  );

  expect(recording.fired).toStrictEqual([5]);
});

test('it stays in research after a markdown write', () => {
  const ctx = setupTest();

  const recording = ctx.run({
    toolName: 'Write',
    toolInput: { file_path: '/repo/docs/plan.md', content: 'x' },
    permissionMode: 'default',
  });

  expect(recording.state.phase).toBe('research');
});

test('it flips to implement on the first code edit', () => {
  const ctx = setupTest();

  const recording = ctx.run({
    toolName: 'Edit',
    toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
    permissionMode: 'default',
  });

  expect(recording.state.phase).toBe('implement');
});

test('it nudges in the implement phase after three consecutive searches', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    {
      toolName: 'Bash',
      toolInput: { command: 'rg -n createSession services' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
  );

  expect(recording).toMatchObject({
    state: { searchRun: 0, huntRun: 0, nudgedAt: 1_000_003 },
    fired: [3],
  });
});

test('it never nudges in the implement phase for whole-file reads alone', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/a.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/b.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/c.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/d.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/e.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/f.ts' }, permissionMode: 'default' },
  );

  expect(recording.fired).toStrictEqual([]);
});

test('it stays silent in the implement phase for one search followed by whole reads', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/a.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/b.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/c.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/d.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/e.ts' }, permissionMode: 'default' },
  );

  expect(recording.fired).toStrictEqual([]);
});

test('it nudges in the implement phase when searches and whole reads interleave to five', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/a.ts' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/docs/x.md' }, permissionMode: 'default' },
    {
      toolName: 'Read',
      toolInput: { file_path: '/repo/src/b.ts', offset: 1, limit: 20 },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'b' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/c.ts' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'c' }, permissionMode: 'default' },
  );

  expect(recording.fired).toStrictEqual([7]);
});

test('it resets the implement counters on a symbol lookup', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/a.ts' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'b' }, permissionMode: 'default' },
    {
      toolName: 'mcp__serena__find_symbol',
      toolInput: { name_path_pattern: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'c' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/b.ts' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'd' }, permissionMode: 'default' },
    { toolName: 'Read', toolInput: { file_path: '/repo/src/c.ts' }, permissionMode: 'default' },
  );

  expect(recording.fired).toStrictEqual([]);
});

test('it keeps plan mode in research even after a code edit', () => {
  const ctx = setupTest();

  const recording = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'plan',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'plan' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'plan' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'plan' },
  );

  expect(recording).toMatchObject({ state: { phase: 'research' }, fired: [] });
});

test('it stays silent and counts nothing inside the cooldown after a nudge', () => {
  const nudged: RetrievalState = {
    ...INITIAL_RETRIEVAL_STATE,
    phase: 'implement',
    nudgedAt: 1_000_000,
  };

  const plan = planRetrievalNudge(
    nudged,
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    1_060_000,
  );

  expect(plan).toStrictEqual({
    state: { ...nudged, calls: 1 },
    nudge: null,
  });
});

test('it counts again once the cooldown has passed', () => {
  const ctx = setupTest();

  const nudged = ctx.run(
    {
      toolName: 'Edit',
      toolInput: { file_path: '/repo/src/a.ts', old_string: 'a', new_string: 'b' },
      permissionMode: 'default',
    },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
  ).state;

  const plan = planRetrievalNudge(
    nudged,
    { toolName: 'Grep', toolInput: { pattern: 'a' }, permissionMode: 'default' },
    nudged.nudgedAt + 120_000,
  );

  expect(plan).toMatchObject({
    state: { searchRun: 1, huntRun: 1, huntSearches: 1 },
    nudge: null,
  });
});
