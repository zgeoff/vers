import { z } from 'zod';
import { collectLoadedSkills } from '../hooks/collect-loaded-skills';
import { planSkillGate } from '../hooks/plan-skill-gate';

// A PreToolUse hook: refuses an Edit, Write, or MultiEdit under a gated path until the session has
// loaded the path's skills, and stays silent otherwise. Reads the hook payload on stdin.

const inputSchema = z.object({
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
const transcriptFile = Bun.file(input.transcript_path);

const transcriptExists = await transcriptFile.exists();

const transcript = transcriptExists ? await transcriptFile.text() : '';
const verdict = planSkillGate(input.cwd, filePath, collectLoadedSkills(transcript));

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
