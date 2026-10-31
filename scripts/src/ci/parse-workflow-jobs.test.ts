import { expect, test } from 'bun:test';
import { parseWorkflowJobs } from './parse-workflow-jobs';

test('it reads each job with its needs, its unwrapped condition and its cancel setting', () => {
  const result = parseWorkflowJobs({
    jobs: {
      bake: { concurrency: { group: 'bake', 'cancel-in-progress': true } },
      taste: { needs: 'bake', if: `\${{ needs.bake.result == 'success' }}` },
      serve: { needs: ['bake', 'taste'], if: true, concurrency: 'serve' },
    },
  });

  expect(result.data).toStrictEqual(
    new Map([
      ['bake', { needs: [], condition: 'success()', cancelsInProgress: true }],
      [
        'taste',
        { needs: ['bake'], condition: "needs.bake.result == 'success'", cancelsInProgress: false },
      ],
      ['serve', { needs: ['bake', 'taste'], condition: 'true', cancelsInProgress: false }],
    ]),
  );
});

test('it rejects a job whose needs is not a job name or a list of them', () => {
  const result = parseWorkflowJobs({ jobs: { taste: { needs: 3 } } });

  expect(result.error?.issues).toPartiallyContain({ path: ['jobs', 'taste', 'needs'] });
});
