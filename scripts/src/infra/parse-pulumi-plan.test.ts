import { expect, test } from 'bun:test';
import { parsePulumiPlan } from './parse-pulumi-plan';

test("it reads each step's op and URN, the diagnostics and the change summary", () => {
  const text = JSON.stringify({
    config: { 'vers-infra:zoneId': 'f00d' },
    steps: [
      {
        op: 'update',
        urn: 'urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::label-bug',
        oldState: { inputs: { color: 'd73a4a' } },
      },
    ],
    diagnostics: [{ severity: 'warning', message: 'provider is slow\n', urn: 'urn:x' }],
    changeSummary: { same: 40, update: 1 },
    duration: 21_000_000_000,
  });

  expect(parsePulumiPlan(text)).toStrictEqual({
    steps: [
      {
        op: 'update',
        urn: 'urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::label-bug',
      },
    ],
    diagnostics: [{ severity: 'warning', message: 'provider is slow\n' }],
    changeSummary: { same: 40, update: 1 },
  });
});

test('it reads a plan without diagnostics or a change summary as empty ones', () => {
  expect(parsePulumiPlan('{"steps": []}')).toStrictEqual({
    steps: [],
    diagnostics: [],
    changeSummary: {},
  });
});

test.each([
  ['text that is not JSON', 'error: preview failed'],
  ['a step without a URN', '{"steps": [{"op": "create"}]}'],
  ['a JSON array', '[]'],
])('it reads %s as no plan', (_label, text) => {
  expect(parsePulumiPlan(text)).toBeUndefined();
});
