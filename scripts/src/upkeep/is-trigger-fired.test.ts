import { expect, test } from 'bun:test';
import { isTriggerFired } from './is-trigger-fired';

test('it fires a release trigger when a newer version exists', () => {
  const trigger = { kind: 'release', pkg: 'x', version: '1.4.11' } as const;

  expect(isTriggerFired(trigger, { latestVersion: '1.4.12', today: '2026-07-11' })).toBe(true);
});

test('it holds a release trigger while the bound version is still latest', () => {
  const trigger = { kind: 'release', pkg: 'x', version: '1.4.11' } as const;

  expect(isTriggerFired(trigger, { latestVersion: '1.4.11', today: '2026-07-11' })).toBe(false);
});

test('it holds a release trigger when the registry lookup produced nothing', () => {
  const trigger = { kind: 'release', pkg: 'x', version: '1.4.11' } as const;

  expect(isTriggerFired(trigger, { today: '2026-07-11' })).toBe(false);
});

test('it fires a date trigger on the recorded day', () => {
  const trigger = { date: '2026-07-18', kind: 'date' } as const;

  expect(isTriggerFired(trigger, { today: '2026-07-18' })).toBe(true);
});

test('it holds a date trigger before the recorded day', () => {
  const trigger = { date: '2026-07-18', kind: 'date' } as const;

  expect(isTriggerFired(trigger, { today: '2026-07-17' })).toBe(false);
});
