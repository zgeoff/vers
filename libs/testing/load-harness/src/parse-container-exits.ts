import * as z from 'zod';
import type { ContainerExit } from './types';

const InspectedContainerSchema = z.object({
  Name: z.string(),
  State: z.object({
    ExitCode: z.number(),
    FinishedAt: z.iso.datetime({ offset: true }),
    OOMKilled: z.boolean(),
    Status: z.string(),
  }),
});

// the output of `docker inspect` over the stack's containers; every container but a running one
// has exited, and the stack sets no restart policy, so an exit lasts to the end of the scenario
export function parseContainerExits(output: string, startedAt: Date): Array<ContainerExit> {
  const containers = z.array(InspectedContainerSchema).parse(JSON.parse(output));

  return containers
    .filter((container) => container.State.Status !== 'running')
    .map((container) => ({
      container: container.Name.replace(/^\//u, ''),
      elapsedMs: Date.parse(container.State.FinishedAt) - startedAt.getTime(),
      exitCode: container.State.ExitCode,
      oomKilled: container.State.OOMKilled,
    }));
}
