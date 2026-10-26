import { expect, test } from 'bun:test';
import { buildScenarioSummary } from './build-scenario-summary';
import { collectContainerFailures } from './collect-container-failures';
import { buildMockScenarioRecording } from './test-utils/build-mock-scenario-recording';

test('it fails a run for each container that exited in any scenario', () => {
  const summaries = [
    buildMockScenarioRecording({ name: 'steady-50' }),
    buildMockScenarioRecording({
      exits: [
        { container: 'vers-load-app-web-1', elapsedMs: 146_000, exitCode: 139, oomKilled: false },
      ],
      name: 'steady-400',
    }),
    buildMockScenarioRecording({
      exits: [
        {
          container: 'vers-load-service-replay-1',
          elapsedMs: 30_000,
          exitCode: 137,
          oomKilled: true,
        },
      ],
      name: 'offline-return',
    }),
  ].map((recording) => buildScenarioSummary(recording));

  expect(collectContainerFailures(summaries)).toStrictEqual([
    'steady-400: vers-load-app-web-1 exited with code 139 at 146.0 s',
    'offline-return: vers-load-service-replay-1 exited with code 137 after the kernel killed it for memory at 30.0 s',
  ]);
});

test('it passes a run whose containers all stayed up', () => {
  const summaries = [buildMockScenarioRecording({ name: 'steady-50' })].map((recording) =>
    buildScenarioSummary(recording),
  );

  expect(collectContainerFailures(summaries)).toStrictEqual([]);
});
