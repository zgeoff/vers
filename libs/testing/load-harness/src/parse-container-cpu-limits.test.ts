import { expect, test } from 'bun:test';
import { parseContainerCPULimits } from './parse-container-cpu-limits';

test('it reads each container CPU limit as cores', () => {
  expect(
    parseContainerCPULimits(
      JSON.stringify([
        { HostConfig: { NanoCpus: 62_500_000 }, Name: '/vers-load-service-replay-1' },
        { HostConfig: { NanoCpus: 2_000_000_000 }, Name: '/vers-load-postgres-1' },
      ]),
    ),
  ).toStrictEqual({ 'vers-load-postgres-1': 2, 'vers-load-service-replay-1': 0.0625 });
});

test('it leaves out a container with no CPU limit', () => {
  expect(
    parseContainerCPULimits(
      JSON.stringify([{ HostConfig: { NanoCpus: 0 }, Name: '/vers-load-app-web-1' }]),
    ),
  ).toStrictEqual({});
});
