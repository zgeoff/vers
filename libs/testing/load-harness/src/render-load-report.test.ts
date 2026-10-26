import { expect, test } from 'bun:test';
import { buildScenarioSummary } from './build-scenario-summary';
import { renderLoadReport } from './render-load-report';
import { buildMockScenarioRecording } from './test-utils/build-mock-scenario-recording';

test('it renders the capacity table and one section per scenario', () => {
  const summaries = [
    buildMockScenarioRecording({
      calls: [
        { durationMs: 12, procedure: 'trackActivityProgress', status: 200 },
        { durationMs: 40, procedure: 'advanceActivity', status: 200 },
      ],
      events: [{ elapsedMs: 60_000, label: 'play stopped' }],
      lockWaits: { acquiredAfterMs: [180], byLock: { 'ShareLock on transaction': 1 }, waits: 1 },
      reconciliation: {
        activities: 12,
        checkpoints: 240,
        outcomes: { completed: 9, failed: 2 },
        simulatedMs: 600_000,
      },
      recording: {
        containers: [
          {
            container: 'vers-load-service-replay-1',
            cpuPercent: 42,
            elapsedMs: 0,
            memoryBytes: 80 * 1024 ** 2,
          },
        ],
        settlementAges: [{ ageMs: 4200, elapsedMs: 10_000 }],
      },
    }),
    buildMockScenarioRecording({
      calls: [
        { durationMs: 0, failure: 'ECONNREFUSED', procedure: 'trackActivityProgress', status: 0 },
      ],
      events: [{ elapsedMs: 60_000, label: 'play stopped' }],
      exits: [
        { container: 'vers-load-app-web-1', elapsedMs: 45_000, exitCode: 137, oomKilled: true },
      ],
      name: 'steady-20',
      players: 20,
    }),
    buildMockScenarioRecording({
      events: [
        { elapsedMs: 120_000, label: 'service-keys stopped' },
        { elapsedMs: 180_000, label: 'service-keys started' },
      ],
      name: 'recovery',
      outage: { endedMs: 180_000, service: 'service-keys', startedMs: 120_000 },
      playMs: 480_000,
      refusals: [{ code: 'NOT_FOUND', procedure: 'stopActivity' }],
      settleMs: undefined,
    }),
  ].map((recording) => buildScenarioSummary(recording));

  expect(
    renderLoadReport(
      {
        commit: 'a31aa1de',
        postgresCPUs: 2,
        serviceCPUs: 1,
        settlementTargetMs: 30_000,
        versions: { current: 'engine-current-hash', retained: 'engine-retained-hash' },
      },
      summaries,
    ),
  ).toMatchInlineSnapshot(`
    "# Load run

    Commit a31aa1de, sim version \`engine-current-hash\` and retained \`engine-retained-hash\`. Each service container runs with its Fly machine's memory and 1 CPU; postgres has 2 CPUs.

    ## Capacity

    Target: settlement age p95 at or under 30.0 s with no failed delivery, no held activity, and a backlog that drains after play stops.

    | Connected players | Simulated hours per wall hour | Settlement p95 | Failed calls | Busiest container | Its mean CPU | Meets target |
    | --- | --- | --- | --- | --- | --- | --- |
    | 10 | 10 | 4.2 s | 0 | vers-load-service-replay-1 | 42% | yes |
    | 20 | 0 | 0.0 s | 1 | none | 0% | no |

    Supported: 10 connected players.
    Next limiting resource: vers-load-app-web-1, which exited with code 137 after the kernel killed it for memory.

    ## steady-10: 10 players

    - 60.0 s: play stopped
    - settled 2.0 s after play stopped

    | Measure | Value |
    | --- | --- |
    | Simulated workload | 0.2 h in 12 activities, 240 checkpoints |
    | Attempt outcomes | completed 9, failed 2 |
    | Completed work, peak | 0 checkpoints verified per minute |
    | Settlement age | p50 4.2 s, p95 4.2 s, p99 4.2 s, max 4.2 s over 1 checkpoints |
    | Lock waits past 100 ms | 1 (p95 180 ms, max 180 ms; ShareLock on transaction 1) |
    | Peak lock waiters, longest transaction | 0, 0 ms |
    | Failed calls | 2 calls, none |
    | Refusals | none |
    | Activities backed off, peak | 0 |
    | End state | 0 checkpoints unproved, 0 activities held, 0 run and 0 avatar XP mismatches |

    | Procedure | Calls | Failed | p50 | p95 |
    | --- | --- | --- | --- | --- |
    | advanceActivity | 1 | 0 | 40 ms | 40 ms |
    | trackActivityProgress | 1 | 0 | 12 ms | 12 ms |

    | Container | CPU mean | CPU p95 | Memory peak |
    | --- | --- | --- | --- |
    | vers-load-service-replay-1 | 42% | 42% | 80 MiB |

    ## steady-20: 20 players

    - 45.0 s: vers-load-app-web-1 exited with code 137 after the kernel killed it for memory
    - 60.0 s: play stopped
    - settled 2.0 s after play stopped

    | Measure | Value |
    | --- | --- |
    | Simulated workload | 0.0 h in 0 activities, 0 checkpoints |
    | Attempt outcomes | none |
    | Completed work, peak | 0 checkpoints verified per minute |
    | Settlement age | p50 0.0 s, p95 0.0 s, p99 0.0 s, max 0.0 s over 0 checkpoints |
    | Lock waits past 100 ms | 0 (p95 0 ms, max 0 ms; none) |
    | Peak lock waiters, longest transaction | 0, 0 ms |
    | Failed calls | 1 calls, no response (ECONNREFUSED) 1 |
    | Refusals | none |
    | Activities backed off, peak | 0 |
    | End state | 0 checkpoints unproved, 0 activities held, 0 run and 0 avatar XP mismatches |

    | Procedure | Calls | Failed | p50 | p95 |
    | --- | --- | --- | --- | --- |
    | trackActivityProgress | 1 | 1 | 0 ms | 0 ms |

    | Container | CPU mean | CPU p95 | Memory peak |
    | --- | --- | --- | --- |

    ## recovery: 10 players

    - 120.0 s: service-keys stopped
    - 180.0 s: service-keys started
    - settled not within the timeout

    | Measure | Value |
    | --- | --- |
    | Simulated workload | 0.0 h in 0 activities, 0 checkpoints |
    | Attempt outcomes | none |
    | Completed work, peak | 0 checkpoints verified per minute |
    | Settlement age | p50 0.0 s, p95 0.0 s, p99 0.0 s, max 0.0 s over 0 checkpoints |
    | Lock waits past 100 ms | 0 (p95 0 ms, max 0 ms; none) |
    | Peak lock waiters, longest transaction | 0, 0 ms |
    | Failed calls | 0 calls, none |
    | Refusals | stopActivity NOT_FOUND 1 |
    | Activities backed off, peak | 0 |
    | End state | 0 checkpoints unproved, 0 activities held, 0 run and 0 avatar XP mismatches |

    | Procedure | Calls | Failed | p50 | p95 |
    | --- | --- | --- | --- | --- |

    | Container | CPU mean | CPU p95 | Memory peak |
    | --- | --- | --- | --- |
    "
  `);
});
