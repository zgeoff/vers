import { expect, test } from 'bun:test';
import { pickSkillTranscripts } from './pick-skill-transcripts';

test('it picks the subagent transcript when the payload names an agent', () => {
  const result = pickSkillTranscripts(
    '/root/transcript.jsonl',
    'abc123',
    [{ modifiedAt: 100, path: '/root/subagents/agent-abc123.jsonl' }],
    20,
  );

  expect(result.primary).toStrictEqual(['/root/subagents/agent-abc123.jsonl']);
});

test('it picks a subagent transcript nested under a workflow directory', () => {
  const result = pickSkillTranscripts(
    '/root/transcript.jsonl',
    'abc123',
    [{ modifiedAt: 100, path: '/root/subagents/workflows/wf_9/agent-abc123.jsonl' }],
    20,
  );

  expect(result.primary).toStrictEqual(['/root/subagents/workflows/wf_9/agent-abc123.jsonl']);
});

test("it offers no fallback once it found the named agent's transcript", () => {
  const result = pickSkillTranscripts(
    '/root/transcript.jsonl',
    'abc123',
    [
      { modifiedAt: 100, path: '/root/subagents/agent-abc123.jsonl' },
      { modifiedAt: 200, path: '/root/subagents/agent-other.jsonl' },
    ],
    20,
  );

  expect(result.fallback).toStrictEqual([]);
});

test('it picks the session transcript when the named agent has no transcript file', () => {
  const result = pickSkillTranscripts(
    '/root/transcript.jsonl',
    'missing',
    [{ modifiedAt: 100, path: '/root/subagents/agent-other.jsonl' }],
    20,
  );

  expect(result.primary).toStrictEqual(['/root/transcript.jsonl']);
});

test('it offers the newest subagent transcripts when no agent is named', () => {
  const result = pickSkillTranscripts(
    '/root/transcript.jsonl',
    undefined,
    [
      { modifiedAt: 100, path: '/root/subagents/agent-a.jsonl' },
      { modifiedAt: 300, path: '/root/subagents/agent-b.jsonl' },
      { modifiedAt: 200, path: '/root/subagents/agent-c.jsonl' },
    ],
    20,
  );

  expect(result.fallback).toStrictEqual([
    '/root/subagents/agent-b.jsonl',
    '/root/subagents/agent-c.jsonl',
    '/root/subagents/agent-a.jsonl',
  ]);
});

test('it caps the fallback at the newest twenty transcripts', () => {
  const subagents = Array.from({ length: 21 }, (_, index) => ({
    modifiedAt: index,
    path: `/root/subagents/agent-${index}.jsonl`,
  }));

  const result = pickSkillTranscripts('/root/transcript.jsonl', undefined, subagents, 20);

  expect(result.fallback).toStrictEqual(
    Array.from({ length: 20 }, (_, index) => `/root/subagents/agent-${20 - index}.jsonl`),
  );
});
