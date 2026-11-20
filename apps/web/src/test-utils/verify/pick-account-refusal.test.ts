import { expect, test } from 'bun:test';
import { pickAccountRefusal } from './pick-account-refusal';

test.each(['wv-k7m@qa.versidle.com', 'WV-Q2@QA.versidle.com'])(
  'it allows the journey account %s',
  (email) => {
    expect(pickAccountRefusal(email)).toBeNull();
  },
);

test.each([
  'e2e-avatar-roster@qa.versidle.com',
  'wv-k7m@versidle.com',
  'wv-k7m@qa.versidle.com.example',
  'player@example.com',
])('it refuses %s, which is no journey account', (email) => {
  expect(pickAccountRefusal(email)).toBe(
    `${email} is not a journey account: remove-account takes only wv-<run>@qa.versidle.com`,
  );
});
