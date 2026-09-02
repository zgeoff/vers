import { expect, test } from 'bun:test';
import { collectLoadedSkills } from './collect-loaded-skills';

function buildSkillLine(skill: string, args?: string): string {
  const argsField = args === undefined ? '' : `,"args":"${args}"`;

  return `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"${skill}"${argsField}}}]}}`;
}

const compactLine = '{"type":"system","subtype":"compact_boundary","content":"..."}';

test('it collects every skill the transcript loaded', () => {
  const transcript = [buildSkillLine('testing'), buildSkillLine('docs-writing', 'review')].join(
    '\n',
  );

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['testing', 'docs-writing']);
});

test('it ignores a load that a compaction boundary summarized away', () => {
  const transcript = [buildSkillLine('testing'), compactLine, buildSkillLine('code-style')].join(
    '\n',
  );

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['code-style']);
});

test('it yields nothing for a transcript with no skill loads', () => {
  expect(collectLoadedSkills('{"type":"user","message":{"content":"hi"}}').size).toBe(0);
});
