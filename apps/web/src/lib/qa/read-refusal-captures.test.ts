import { expect, onTestFinished, test } from 'bun:test';
import { readRefusalCaptures } from './read-refusal-captures';

test('it reads each capture under the capture prefix, oldest first', () => {
  localStorage.setItem(
    'vers-qa-refusal-capture:capture_b',
    '{"captureID":"capture_b","capturedAt":2000,"pendingUntil":9000,"status":"pending"}',
  );

  localStorage.setItem(
    'vers-qa-refusal-capture:capture_a',
    '{"captureID":"capture_a","capturedAt":1000,"pendingUntil":9000,"status":"complete"}',
  );

  localStorage.setItem('vers-qa-other', '{"captureID":"capture_c"}');

  onTestFinished(() => {
    localStorage.removeItem('vers-qa-refusal-capture:capture_a');
    localStorage.removeItem('vers-qa-refusal-capture:capture_b');
    localStorage.removeItem('vers-qa-other');
  });

  expect(readRefusalCaptures(localStorage)).toStrictEqual([
    {
      capture: { captureID: 'capture_a', capturedAt: 1000, pendingUntil: 9000, status: 'complete' },
      key: 'vers-qa-refusal-capture:capture_a',
    },
    {
      capture: { captureID: 'capture_b', capturedAt: 2000, pendingUntil: 9000, status: 'pending' },
      key: 'vers-qa-refusal-capture:capture_b',
    },
  ]);
});

test('it skips a capture key whose value is not a capture', () => {
  localStorage.setItem('vers-qa-refusal-capture:capture_a', '{not json');
  localStorage.setItem('vers-qa-refusal-capture:capture_b', '{"captureID":"capture_b"}');

  onTestFinished(() => {
    localStorage.removeItem('vers-qa-refusal-capture:capture_a');
    localStorage.removeItem('vers-qa-refusal-capture:capture_b');
  });

  expect(readRefusalCaptures(localStorage)).toStrictEqual([]);
});
