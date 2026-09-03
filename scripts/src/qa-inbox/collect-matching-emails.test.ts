import { expect, test } from 'bun:test';
import { collectMatchingEmails } from './collect-matching-emails';

test('it keeps the emails sent to the address after the cutoff, newest first', () => {
  const matched = collectMatchingEmails(
    [
      {
        createdAt: '2026-09-04T10:00:00.000Z',
        from: 'noreply@versidle.com',
        id: 'older',
        subject: 'Welcome to vers',
        to: ['qa+1@qa.versidle.com'],
      },
      {
        createdAt: '2026-09-04T10:05:00.000Z',
        from: 'noreply@versidle.com',
        id: 'newer',
        subject: 'Reset your vers password',
        to: ['qa+1@qa.versidle.com'],
      },
      {
        createdAt: '2026-09-04T10:06:00.000Z',
        from: 'noreply@versidle.com',
        id: 'other-address',
        subject: 'Welcome to vers',
        to: ['qa+2@qa.versidle.com'],
      },
      {
        createdAt: '2026-09-04T09:00:00.000Z',
        from: 'noreply@versidle.com',
        id: 'too-old',
        subject: 'Welcome to vers',
        to: ['qa+1@qa.versidle.com'],
      },
    ],
    { since: new Date('2026-09-04T09:30:00.000Z'), to: 'qa+1@qa.versidle.com' },
  );

  expect(matched.map((email) => email.id)).toStrictEqual(['newer', 'older']);
});

test('it matches the address without regard to case or surrounding whitespace', () => {
  const matched = collectMatchingEmails(
    [
      {
        createdAt: '2026-09-04T10:00:00.000Z',
        from: 'noreply@versidle.com',
        id: 'mixed-case',
        subject: 'Welcome to vers',
        to: ['ops@versidle.com', ' QA+1@QA.versidle.com '],
      },
    ],
    { since: new Date('2026-09-04T09:30:00.000Z'), to: 'qa+1@qa.versidle.com' },
  );

  expect(matched.map((email) => email.id)).toStrictEqual(['mixed-case']);
});

test('it keeps an email created exactly at the cutoff', () => {
  const matched = collectMatchingEmails(
    [
      {
        createdAt: '2026-09-04T09:30:00.000Z',
        from: 'noreply@versidle.com',
        id: 'at-cutoff',
        subject: 'Welcome to vers',
        to: ['qa+1@qa.versidle.com'],
      },
    ],
    { since: new Date('2026-09-04T09:30:00.000Z'), to: 'qa+1@qa.versidle.com' },
  );

  expect(matched.map((email) => email.id)).toStrictEqual(['at-cutoff']);
});

test('it returns nothing when no email reaches the address', () => {
  const matched = collectMatchingEmails(
    [
      {
        createdAt: '2026-09-04T10:00:00.000Z',
        from: 'noreply@versidle.com',
        id: 'other',
        subject: 'Welcome to vers',
        to: ['qa+2@qa.versidle.com'],
      },
    ],
    { since: new Date('2026-09-04T09:30:00.000Z'), to: 'qa+1@qa.versidle.com' },
  );

  expect(matched).toBeEmpty();
});
