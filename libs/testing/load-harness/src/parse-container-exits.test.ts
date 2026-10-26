import { expect, test } from 'bun:test';
import { parseContainerExits } from './parse-container-exits';

test('it reads a container that stopped as an exit timed from the scenario start', () => {
  expect(
    parseContainerExits(
      JSON.stringify([
        {
          Name: '/vers-load-app-web-1',
          State: {
            ExitCode: 139,
            FinishedAt: '2026-03-04T05:06:09.250000000Z',
            OOMKilled: false,
            Status: 'exited',
          },
        },
      ]),
      new Date('2026-03-04T05:06:07.000Z'),
    ),
  ).toStrictEqual([
    { container: 'vers-load-app-web-1', elapsedMs: 2250, exitCode: 139, oomKilled: false },
  ]);
});

test('it reads a running container as no exit', () => {
  expect(
    parseContainerExits(
      JSON.stringify([
        {
          Name: '/vers-load-postgres-1',
          State: {
            ExitCode: 0,
            FinishedAt: '0001-01-01T00:00:00Z',
            OOMKilled: false,
            Status: 'running',
          },
        },
      ]),
      new Date('2026-03-04T05:06:07.000Z'),
    ),
  ).toStrictEqual([]);
});

test('it reads the kernel memory kill of a container', () => {
  expect(
    parseContainerExits(
      JSON.stringify([
        {
          Name: '/vers-load-service-replay-1',
          State: {
            ExitCode: 137,
            FinishedAt: '2026-03-04T05:06:08.000Z',
            OOMKilled: true,
            Status: 'exited',
          },
        },
      ]),
      new Date('2026-03-04T05:06:07.000Z'),
    )[0]?.oomKilled,
  ).toBe(true);
});
