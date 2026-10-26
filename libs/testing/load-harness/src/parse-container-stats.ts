import * as z from 'zod';
import type { ContainerSample } from './types';

const DockerStatsLineSchema = z.object({
  CPUPerc: z.string(),
  MemUsage: z.string(),
  Name: z.string(),
});

const MEMORY_UNIT_BYTES: ReadonlyMap<string, number> = new Map([
  ['B', 1],
  ['GiB', 1024 ** 3],
  ['KiB', 1024],
  ['MiB', 1024 ** 2],
  ['kB', 1000],
]);

// one line of `docker stats --format '{{json .}}'`; a container that is starting or stopping
// prints placeholder dashes, which read as no sample
export function parseContainerStats(line: string, elapsedMs: number): ContainerSample | undefined {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }

  const parsed = DockerStatsLineSchema.safeParse(value);

  if (!parsed.success) {
    return undefined;
  }

  const cpu = /^(?<percent>[\d.]+)%$/u.exec(parsed.data.CPUPerc.trim());
  const cpuPercent = Number(cpu?.groups?.['percent']);
  const memory = /^(?<amount>[\d.]+)(?<unit>[A-Za-z]+)/u.exec(parsed.data.MemUsage.trim());
  const unitBytes = MEMORY_UNIT_BYTES.get(memory?.groups?.['unit'] ?? '');
  const amount = Number(memory?.groups?.['amount']);

  if (Number.isNaN(cpuPercent) || unitBytes === undefined || Number.isNaN(amount)) {
    return undefined;
  }

  return {
    container: parsed.data.Name,
    cpuPercent,
    elapsedMs,
    memoryBytes: amount * unitBytes,
  };
}
