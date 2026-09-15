import path from 'node:path';

export interface SubagentTranscript {
  readonly path: string;
  readonly modifiedAt: number;
}

export interface SkillTranscriptPick {
  readonly primary: ReadonlyArray<string>;
  readonly fallback: ReadonlyArray<string>;
}

export function pickSkillTranscripts(
  rootTranscript: string,
  agentID: string | undefined,
  subagents: ReadonlyArray<SubagentTranscript>,
  fallbackLimit: number,
): SkillTranscriptPick {
  const named =
    agentID === undefined
      ? undefined
      : subagents.find((entry) => path.basename(entry.path) === `agent-${agentID}.jsonl`);

  if (named !== undefined) {
    return { fallback: [], primary: [named.path] };
  }

  const fallback = subagents
    .toSorted((a, b) => b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path))
    .slice(0, fallbackLimit)
    .map((entry) => entry.path);

  return { fallback, primary: [rootTranscript] };
}
