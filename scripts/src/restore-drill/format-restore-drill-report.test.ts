import { expect, test } from 'bun:test';
import { formatRestoreDrillReport } from './format-restore-drill-report';

test('it reports a pass when every check holds', () => {
  const report = formatRestoreDrillReport([
    { area: 'sessions', name: 'one verified session per user', violations: [] },
    { area: 'chain-anchors', name: 'every activity has its chain', violations: [] },
  ]);

  expect(report).toBe(
    [
      'ok   sessions: one verified session per user',
      'ok   chain-anchors: every activity has its chain',
      'PASS: 2 of 2 checks hold',
    ].join('\n'),
  );
});

test('it lists the violations of a broken check and fails the report', () => {
  const report = formatRestoreDrillReport([
    { area: 'sessions', name: 'one verified session per user', violations: [] },
    {
      area: 'chain-anchors',
      name: 'every activity has its chain',
      violations: ['activity act_a', 'activity act_b'],
    },
  ]);

  expect(report).toBe(
    [
      'ok   sessions: one verified session per user',
      'FAIL chain-anchors: every activity has its chain (2)',
      '     activity act_a',
      '     activity act_b',
      'FAIL: 1 of 2 checks broken',
    ].join('\n'),
  );
});

test('it lists the first ten violations of a check and counts the rest', () => {
  const report = formatRestoreDrillReport([
    {
      area: 'verified-progress',
      name: 'settled XP comes only from verified checkpoints',
      violations: Array.from({ length: 12 }, (_, index) => `activity act_${index + 1}`),
    },
  ]);

  expect(report).toBe(
    [
      'FAIL verified-progress: settled XP comes only from verified checkpoints (12)',
      '     activity act_1',
      '     activity act_2',
      '     activity act_3',
      '     activity act_4',
      '     activity act_5',
      '     activity act_6',
      '     activity act_7',
      '     activity act_8',
      '     activity act_9',
      '     activity act_10',
      '     and 2 more',
      'FAIL: 1 of 1 checks broken',
    ].join('\n'),
  );
});
