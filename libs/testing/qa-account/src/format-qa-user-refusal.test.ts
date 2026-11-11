import { expect, test } from 'bun:test';
import { formatQAUserRefusal } from './format-qa-user-refusal';

test.each([
  {
    expected:
      'refusing "player@versidle.com": only addresses under qa.versidle.com are QA accounts',
    raw: 'player@versidle.com',
    reason: 'outside-qa-domain',
  },
  {
    expected:
      'invalid QA account name "qa 007": use letters, digits, ".", "_", "+" or "-", starting with a letter or digit',
    raw: 'qa 007',
    reason: 'invalid-name',
  },
  {
    expected: 'the QA account name "q1" yields no valid avatar name; pick another --user',
    raw: 'q1',
    reason: 'invalid-avatar-name',
  },
  {
    expected: 'the QA account name "qa-wren" yields no valid username; pick another --user',
    raw: 'qa-wren',
    reason: 'invalid-username',
  },
] as const)('it explains a $reason refusal', (row) => {
  expect(formatQAUserRefusal(row.raw, row.reason)).toBe(row.expected);
});
