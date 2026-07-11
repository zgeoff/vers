import { expect, test } from 'bun:test';
import { parseTrigger } from './parse-trigger';

test('it reads a release trigger out of an issue body', () => {
  const body = '```\ntrigger: release @elysiajs/opentelemetry >1.4.11\n```\n\nContext paragraph.';

  expect(parseTrigger(body)).toStrictEqual({
    kind: 'release',
    pkg: '@elysiajs/opentelemetry',
    version: '1.4.11',
  });
});

test('it reads a date trigger out of an issue body', () => {
  const body = '```\ntrigger: date 2026-07-18\n```\n\nContext paragraph.';

  expect(parseTrigger(body)).toStrictEqual({ date: '2026-07-18', kind: 'date' });
});

test('it returns null when the body carries no trigger line', () => {
  expect(parseTrigger('just prose, no trigger anywhere')).toBeNull();
});

test('it rejects a date trigger that is not YYYY-MM-DD', () => {
  expect(parseTrigger('trigger: date next tuesday')).toBeNull();
});

test('it rejects a release trigger without a > version bound', () => {
  expect(parseTrigger('trigger: release @elysiajs/opentelemetry 1.4.11')).toBeNull();
});
