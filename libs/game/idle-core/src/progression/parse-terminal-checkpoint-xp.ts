import * as z from 'zod';
import { isTerminalCheckpointType } from '../utils/is-terminal-checkpoint-type';

const TerminalCheckpointPayloadSchema = z.object({
  rewards: z.object({ xp: z.number() }),
  type: z.string(),
});

export function parseTerminalCheckpointXP(payload: unknown): number | undefined {
  const parsed = TerminalCheckpointPayloadSchema.safeParse(payload);

  if (!parsed.success || !isTerminalCheckpointType(parsed.data.type)) {
    return undefined;
  }

  return parsed.data.rewards.xp;
}
