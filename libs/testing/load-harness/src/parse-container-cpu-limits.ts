import * as z from 'zod';

const InspectedContainerSchema = z.object({
  HostConfig: z.object({ NanoCpus: z.number() }),
  Name: z.string(),
});

const NANO_CPUS_PER_CORE = 1e9;

// `docker inspect` reads a container with no CPU limit as 0 NanoCpus
export function parseContainerCPULimits(output: string): Record<string, number> {
  const containers = z.array(InspectedContainerSchema).parse(JSON.parse(output));

  return Object.fromEntries(
    containers
      .filter((container) => container.HostConfig.NanoCpus > 0)
      .map((container) => [
        container.Name.replace(/^\//u, ''),
        container.HostConfig.NanoCpus / NANO_CPUS_PER_CORE,
      ]),
  );
}
