import { expect, test } from 'bun:test';
import { checkIssue } from './check-issue';

test('it passes a fully triaged feature issue', () => {
  const findings = checkIssue({
    body: '## Player story\n\nYou log in.\n\n## Scope\n\n- a behavior',
    labels: ['feature', 'area/game', 'p2-medium'],
    milestone: 'P3 · World map',
  });

  expect(findings).toStrictEqual([]);
});

test('it flags a feature issue without a Scope section', () => {
  const findings = checkIssue({
    body: 'Just a lead paragraph.',
    labels: ['feature', 'area/services', 'p1-high'],
    milestone: 'P2 · Game backend spine',
  });

  expect(findings).toStrictEqual([
    {
      rule: 'a feature issue follows its template',
      stub: { kind: 'section', templatePath: '.github/ISSUE_TEMPLATE/feature.md', title: 'Scope' },
      task: 'Add a `## Scope` section listing the behaviors this delivers',
    },
  ]);
});

test('it requires a player story on an area/game feature', () => {
  const findings = checkIssue({
    body: '## Scope\n\n- a behavior',
    labels: ['feature', 'area/game', 'p2-medium'],
    milestone: 'P3 · World map',
  });

  expect(findings.map((finding) => finding.task)).toStrictEqual([
    'Add a `## Player story` section describing what the player perceives once this ships',
  ]);
});

test('it accepts a player story regardless of heading case', () => {
  const findings = checkIssue({
    body: '## Player Story\n\nYou log in.\n\n## Scope\n\n- a behavior',
    labels: ['feature', 'area/game', 'p2-medium'],
    milestone: 'P3 · World map',
  });

  expect(findings).toStrictEqual([]);
});

test('it does not require a player story on a non-game feature', () => {
  const findings = checkIssue({
    body: '## Scope\n\n- a behavior',
    labels: ['feature', 'area/platform', 'p2-medium'],
    milestone: 'P0 · Tooling',
  });

  expect(findings).toStrictEqual([]);
});

test('it flags an untriaged issue once per missing triage field', () => {
  const findings = checkIssue({ body: 'prose', labels: [], milestone: null });

  expect(findings.map((finding) => finding.task)).toIncludeSameMembers([
    'Add an `area/*` label for the subsystem it touches (e.g. `area/platform`, `area/game`)',
    'Add a type label (`feature`, `bug`, `chore`, …)',
    'Add a priority label (`p0-critical`, `p1-high`, `p2-medium`)',
    'Assign the delivery-phase milestone',
  ]);
});

test('it rejects a priority label outside the supported set', () => {
  const findings = checkIssue({
    body: '## Scope\n\n- a behavior',
    labels: ['feature', 'area/platform', 'p9-placeholder'],
    milestone: 'P0 · Tooling',
  });

  expect(findings.map((finding) => finding.task)).toStrictEqual([
    'Add a priority label (`p0-critical`, `p1-high`, `p2-medium`)',
  ]);
});

test('it requires observed, expected, and repro sections on a bug', () => {
  const findings = checkIssue({
    body: '## Observed\n\nIt crashes.',
    labels: ['bug', 'area/web', 'p1-high'],
    milestone: 'P3 · World map',
  });

  expect(findings.map((finding) => finding.task)).toStrictEqual([
    'Add a `## Expected` section',
    'Add a `## Repro` section',
  ]);
});

test('it passes a complete bug issue', () => {
  const findings = checkIssue({
    body: '## Observed\n\nIt crashes.\n\n## Expected\n\nNo crash.\n\n## Repro\n\n1. run it',
    labels: ['bug', 'area/web', 'p1-high'],
    milestone: 'P3 · World map',
  });

  expect(findings).toStrictEqual([]);
});

test('it passes a well-formed upkeep issue without milestone or priority', () => {
  const findings = checkIssue({
    body: '```\ntrigger: date 2026-08-01\n```\n\nDrop the override.',
    labels: ['upkeep', 'area/platform'],
    milestone: null,
  });

  expect(findings).toStrictEqual([]);
});

test('it flags an upkeep issue with a milestone', () => {
  const findings = checkIssue({
    body: '```\ntrigger: date 2026-08-01\n```',
    labels: ['upkeep', 'area/platform'],
    milestone: 'P0 · Tooling',
  });

  expect(findings.map((finding) => finding.task)).toStrictEqual(['Remove the milestone']);
});

test('it flags an upkeep issue without a parseable trigger line, offering a stub', () => {
  const findings = checkIssue({
    body: 'no trigger here',
    labels: ['upkeep', 'area/platform'],
    milestone: null,
  });

  expect(findings).toStrictEqual([
    {
      rule: 'an upkeep issue opens with a machine-readable trigger line the dep-health sweep evaluates',
      stub: { kind: 'literal', markdown: '```\ntrigger: date <YYYY-MM-DD>\n```' },
      task: 'Add a trigger line (`trigger: date <YYYY-MM-DD>` or `trigger: release <pkg> ><version>`)',
    },
  ]);
});

test('it exempts the dep-health report issues', () => {
  const findings = checkIssue({
    body: 'generated report',
    labels: ['dep-outdated'],
    milestone: null,
  });

  expect(findings).toStrictEqual([]);
});
