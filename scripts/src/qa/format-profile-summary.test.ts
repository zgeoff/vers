import { expect, test } from 'bun:test';
import { formatProfileSummary } from './format-profile-summary';

test('it ranks functions by self time with their share of the total', () => {
  const summary = formatProfileSummary(
    {
      nodes: [
        {
          callFrame: { columnNumber: 0, functionName: '(root)', lineNumber: 0, url: '' },
          id: 1,
        },
        {
          callFrame: {
            columnNumber: 12,
            functionName: 'tick',
            lineNumber: 40,
            url: 'https://versidle.com/assets/worker.js',
          },
          id: 2,
        },
        {
          callFrame: {
            columnNumber: 3,
            functionName: '',
            lineNumber: 7,
            url: 'https://versidle.com/assets/worker.js',
          },
          id: 3,
        },
      ],
      samples: [2, 3, 2, 1],
      timeDeltas: [1000, 500, 2000, 500],
    },
    4,
  );

  expect(summary).toBe(
    [
      'total 4ms sampled over 4s',
      '75.0%\t3ms\ttick\tworker.js:40:12',
      '12.5%\t1ms\t(anon)\tworker.js:7:3',
      '12.5%\t1ms\t(root)\t:0:0',
    ].join('\n'),
  );
});

test('it prints only the total for a profile with no samples', () => {
  const summary = formatProfileSummary({ nodes: [], samples: [], timeDeltas: [] }, 2);

  expect(summary).toBe('total 0ms sampled over 2s');
});
