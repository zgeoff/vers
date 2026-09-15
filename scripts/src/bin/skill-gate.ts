import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { collectLoadedSkills } from '../hooks/collect-loaded-skills';
import type { SubagentTranscript } from '../hooks/pick-skill-transcripts';
import { pickSkillTranscripts } from '../hooks/pick-skill-transcripts';
import { planSkillGate } from '../hooks/plan-skill-gate';

// A PreToolUse hook: refuses an Edit, Write, or MultiEdit under a gated path until the session has
// loaded the path's skills, and stays silent otherwise. Reads the hook payload on stdin.

const FALLBACK_LIMIT = 20;

const inputSchema = z.object({
  agent_id: z.string().optional(),
  cwd: z.string(),
  tool_input: z.object({ file_path: z.string() }),
  transcript_path: z.string(),
});

const payload: unknown = await Bun.stdin.json();

const parsed = inputSchema.safeParse(payload);

if (!parsed.success) {
  process.exit(0);
}

const input = parsed.data;
const filePath = input.tool_input.file_path;
const subagentsDir = `${input.transcript_path.replace(/\.jsonl$/, '')}/subagents`;

const subagents = await collectSubagentTranscripts(subagentsDir);

const picked = pickSkillTranscripts(
  input.transcript_path,
  input.agent_id,
  subagents,
  FALLBACK_LIMIT,
);

const loadedSkills = await readLoadedSkills(picked.primary, picked.fallback);

const verdict = planSkillGate(input.cwd, filePath, loadedSkills);

if (verdict.kind === 'deny') {
  const skills = verdict.missing.map((skill) => `\`${skill}\``).join(' and ');

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Load the ${skills} skill with the Skill tool before editing ${filePath}, then retry the edit. AGENTS.md lists the skills each kind of work needs under "Required reading".`,
      },
    }),
  );
}

async function collectSubagentTranscripts(dir: string): Promise<ReadonlyArray<SubagentTranscript>> {
  const entries: Array<SubagentTranscript> = [];

  try {
    for await (const hit of new Bun.Glob('**/agent-*.jsonl').scan({
      absolute: true,
      cwd: dir,
      onlyFiles: true,
    })) {
      const info = await stat(hit);

      entries.push({ modifiedAt: info.mtimeMs, path: hit });
    }
  } catch {
    return [];
  }

  return entries;
}

async function readLoadedSkills(
  primary: ReadonlyArray<string>,
  fallback: ReadonlyArray<string>,
): Promise<ReadonlySet<string>> {
  const fromPrimary = await collectSkillsFromTranscripts(primary);

  return fromPrimary.size > 0 ? fromPrimary : collectSkillsFromTranscripts(fallback);
}

async function collectSkillsFromTranscripts(paths: ReadonlyArray<string>): Promise<Set<string>> {
  const skills = new Set<string>();

  for (const transcriptPath of paths) {
    const file = Bun.file(transcriptPath);

    if (!(await file.exists())) {
      continue;
    }

    const text = await file.text();

    for (const skill of collectLoadedSkills(text)) {
      skills.add(skill);
    }
  }

  return skills;
}
