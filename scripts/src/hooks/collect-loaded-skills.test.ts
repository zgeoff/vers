import { expect, test } from 'bun:test';
import { collectLoadedSkills } from './collect-loaded-skills';

const compactLine = '{"type":"system","subtype":"compact_boundary","content":"..."}';

test('it collects a skill load serialized name-first', () => {
  const transcript =
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"testing"}}]}}';

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['testing']);
});

test('it collects a skill load serialized input-first', () => {
  const transcript =
    '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{"skill":"docs-writing"},"name":"Skill"}]}}';

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['docs-writing']);
});

test('it collects a skill load with args serialized before skill', () => {
  const transcript =
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"args":"review","skill":"testing"}}]}}';

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['testing']);
});

test('it collects loads across lines in mixed key orders', () => {
  const transcript = [
    '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"testing"}}]}}',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{"skill":"docs-writing"},"name":"Skill"}]}}',
  ].join('\n');

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['testing', 'docs-writing']);
});

test('it ignores a load that a compaction boundary summarized away', () => {
  const transcript = [
    '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{"skill":"testing"},"name":"Skill"}]}}',
    compactLine,
    '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{"skill":"code-style"},"name":"Skill"}]}}',
  ].join('\n');

  expect([...collectLoadedSkills(transcript)]).toStrictEqual(['code-style']);
});

test('it ignores tool calls and lines that are not skill loads', () => {
  const transcript = [
    '{"type":"assistant","message":{"content":[{"type":"tool_use","input":{"skill":"docs-writing"},"name":"Read"}]}}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"still thinking"}]}}',
    'not json at all',
    '{"type":"user","message":{"content":"hi"}}',
  ].join('\n');

  expect(collectLoadedSkills(transcript).size).toBe(0);
});
