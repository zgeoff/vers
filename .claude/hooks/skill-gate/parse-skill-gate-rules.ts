import type { SkillGate, SkillGateRulesResult } from './types.ts';

// Parses a repo's .claude/skill-gate.json: an optional `ignore` list of path segments and a `gates`
// list of `{ match, skills }`, where `match` globs the path relative to the project root.
export function parseSkillGateRules(text: string): SkillGateRulesResult {
  const value = parseJSON(text);

  if (value instanceof Error) {
    return { ok: false, error: `is not valid JSON: ${value.message}` };
  }

  if (!isRecord(value)) {
    return { ok: false, error: 'must hold a JSON object' };
  }

  return parseRulesRecord(value);
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseRulesRecord(value: Readonly<Record<string, unknown>>): SkillGateRulesResult {
  const ignore = value['ignore'] ?? [];

  if (!isStringArray(ignore)) {
    return { ok: false, error: '`ignore` must be an array of strings' };
  }

  const gates = value['gates'];

  if (!Array.isArray(gates)) {
    return { ok: false, error: '`gates` must be an array' };
  }

  return parseGates(ignore, gates);
}

function parseGates(ignore: readonly string[], gates: readonly unknown[]): SkillGateRulesResult {
  const parsed = gates.map((gate, index) => parseGate(gate, index));
  const error = parsed.find((gate) => typeof gate === 'string');

  if (typeof error === 'string') {
    return { ok: false, error };
  }

  return { ok: true, rules: { ignore, gates: parsed.filter((gate) => typeof gate !== 'string') } };
}

function parseGate(gate: unknown, index: number): SkillGate | string {
  if (!isRecord(gate) || typeof gate['match'] !== 'string' || gate['match'] === '') {
    return `gate ${index} needs a non-empty string \`match\``;
  }

  const skills = gate['skills'];

  if (!isStringArray(skills) || skills.length === 0) {
    return `gate "${gate['match']}" needs a non-empty \`skills\` array`;
  }

  return { match: gate['match'], skills };
}
