import { expect, test } from 'bun:test';
import { parseContainerStats } from './parse-container-stats';

test('it parses the CPU share and resident memory of a running container', () => {
  expect(
    parseContainerStats(
      '{"BlockIO":"0B / 0B","CPUPerc":"87.25%","MemPerc":"20.31%","MemUsage":"52.01MiB / 256MiB","Name":"vers-load-service-replay-1","NetIO":"1kB / 2kB","PIDs":"11"}',
      4000,
    ),
  ).toStrictEqual({
    container: 'vers-load-service-replay-1',
    cpuPercent: 87.25,
    elapsedMs: 4000,
    memoryBytes: 52.01 * 1024 ** 2,
  });
});

test('it reads gibibytes as bytes', () => {
  expect(
    parseContainerStats(
      '{"CPUPerc":"150.00%","MemUsage":"1.5GiB / 8GiB","Name":"vers-load-postgres-1"}',
      0,
    )?.memoryBytes,
  ).toBe(1.5 * 1024 ** 3);
});

test('it reads the placeholder line of a starting container as no sample', () => {
  expect(
    parseContainerStats('{"CPUPerc":"--","MemUsage":"-- / --","Name":"vers-load-app-web-1"}', 0),
  ).toBeUndefined();
});

test('it reads a line that is not JSON as no sample', () => {
  expect(parseContainerStats('Error response from daemon', 0)).toBeUndefined();
});
