export function collectLoadedSkills(transcript: string): ReadonlySet<string> {
  const lines = transcript.split('\n');
  const lastBoundary = lines.findLastIndex((line) => line.includes(COMPACT_BOUNDARY_MARKER));

  const loaded = new Set<string>();

  for (const line of lines.slice(lastBoundary + 1)) {
    for (const match of line.matchAll(SKILL_CALL_PATTERN)) {
      const skill = match.groups?.['skill'];

      if (skill !== undefined) {
        loaded.add(skill);
      }
    }
  }

  return loaded;
}

const COMPACT_BOUNDARY_MARKER = '"subtype":"compact_boundary"';

// A Skill tool_use serializes its input with `skill` as the first key, with or without `args` after it.
const SKILL_CALL_PATTERN = /"name":"Skill","input":\{"skill":"(?<skill>[^"]+)"/g;
