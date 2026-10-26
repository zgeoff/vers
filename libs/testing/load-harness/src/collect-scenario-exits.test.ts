import { expect, test } from 'bun:test';
import { collectScenarioExits } from './collect-scenario-exits';

test('it keeps a crash that the scheduled restart hid from the final inspection', () => {
  expect(
    collectScenarioExits(
      [],
      [
        {
          container: 'vers-load-service-replay-1',
          elapsedMs: 150_000,
          exitCode: 139,
          oomKilled: false,
        },
        {
          container: 'vers-load-service-keys-1',
          elapsedMs: 120_400,
          exitCode: 143,
          oomKilled: false,
        },
      ],
      { container: 'vers-load-service-keys-1', elapsedMs: 120_000 },
    ),
  ).toStrictEqual([
    {
      container: 'vers-load-service-replay-1',
      elapsedMs: 150_000,
      exitCode: 139,
      oomKilled: false,
    },
  ]);
});

test('it keeps a crash of the stopped service from before its requested stop', () => {
  expect(
    collectScenarioExits(
      [],
      [{ container: 'vers-load-service-keys-1', elapsedMs: 90_000, exitCode: 1, oomKilled: false }],
      { container: 'vers-load-service-keys-1', elapsedMs: 120_000 },
    ),
  ).toStrictEqual([
    { container: 'vers-load-service-keys-1', elapsedMs: 90_000, exitCode: 1, oomKilled: false },
  ]);
});

test('it lists an exit seen in both inspections once', () => {
  expect(
    collectScenarioExits(
      [{ container: 'vers-load-postgres-1', elapsedMs: 200_000, exitCode: 137, oomKilled: true }],
      [{ container: 'vers-load-postgres-1', elapsedMs: 200_000, exitCode: 137, oomKilled: true }],
      { container: 'vers-load-service-keys-1', elapsedMs: 120_000 },
    ),
  ).toStrictEqual([
    { container: 'vers-load-postgres-1', elapsedMs: 200_000, exitCode: 137, oomKilled: true },
  ]);
});

test('it reads the final exits alone when no outage ran', () => {
  expect(
    collectScenarioExits(
      [{ container: 'vers-load-app-web-1', elapsedMs: 139_200, exitCode: 139, oomKilled: false }],
      [],
      undefined,
    ),
  ).toStrictEqual([
    { container: 'vers-load-app-web-1', elapsedMs: 139_200, exitCode: 139, oomKilled: false },
  ]);
});
