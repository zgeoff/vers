import path from 'node:path';
import { z } from 'zod';
import { INITIAL_RETRIEVAL_STATE, planRetrievalNudge } from '../hooks/plan-retrieval-nudge';
import type { RetrievalState } from '../hooks/types';

// runs as a PreToolUse hook on every tool and as a SessionEnd hook

const inputSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string(),
  permission_mode: z.string().default('default'),
  tool_name: z.string().default(''),
  tool_input: z.record(z.string(), z.unknown()).default({}),
});

const stateSchema = z.object({
  phase: z.enum(['research', 'implement']),
  searchRun: z.number(),
  huntRun: z.number(),
  huntSearches: z.number(),
  lookupRun: z.number(),
  nudgedAt: z.number(),
  calls: z.number(),
});

const payload = await readPayload();

const parsed = inputSchema.safeParse(payload);

if (!parsed.success) {
  process.exit(0);
}

const input = parsed.data;

const stateDir = path.join(
  process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd(),
  'tmp',
  'retrieval-policy',
);

const stateFile = Bun.file(path.join(stateDir, `${input.session_id}.json`));

const stateExists = await stateFile.exists();

if (input.hook_event_name === 'SessionEnd') {
  if (stateExists) {
    await stateFile.delete();
  }

  process.exit(0);
}

if (input.hook_event_name !== 'PreToolUse') {
  process.exit(0);
}

const now = Date.now();

const state = await loadState();

const plan = planRetrievalNudge(
  state,
  { toolName: input.tool_name, toolInput: input.tool_input, permissionMode: input.permission_mode },
  now,
);

await Bun.write(stateFile, `${JSON.stringify(plan.state, null, 2)}\n`);

if (plan.nudge !== null) {
  await recordFire();

  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: plan.nudge },
      systemMessage: `retrieval-policy: ${plan.nudge}`,
    }),
  );
}

async function loadState(): Promise<RetrievalState> {
  if (!stateExists) {
    return INITIAL_RETRIEVAL_STATE;
  }

  const raw = await readStateFile();

  const stored = stateSchema.safeParse(raw);

  return stored.success ? stored.data : INITIAL_RETRIEVAL_STATE;
}

// Malformed JSON on stdin is treated like any other invalid payload: the hook stays silent.
async function readPayload(): Promise<unknown> {
  try {
    return await Bun.stdin.json();
  } catch {
    return null;
  }
}

// A corrupt state file starts the session's counters over rather than failing the hook.
async function readStateFile(): Promise<unknown> {
  try {
    return await stateFile.json();
  } catch {
    return null;
  }
}

async function recordFire(): Promise<void> {
  const record = {
    t: new Date(now).toISOString(),
    session: input.session_id,
    phase: plan.state.phase,
    tool: input.tool_name,
    call: plan.state.calls,
  };

  const log = Bun.file(path.join(stateDir, 'fires.jsonl'));

  const logExists = await log.exists();

  const existing = logExists ? await log.text() : '';

  await Bun.write(log, `${existing}${JSON.stringify(record)}\n`);
}
