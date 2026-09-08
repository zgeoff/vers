import * as z from 'zod';
import type { AutoStopMode } from './types';

const flyConfigSchema = z.looseObject({
  http_service: z.looseObject({ auto_stop_machines: z.unknown().optional() }).optional(),
});

export async function readAutoStopMode(configDir: string): Promise<AutoStopMode> {
  const source = await Bun.file(`${configDir}/fly.toml`).text();

  const config = flyConfigSchema.parse(Bun.TOML.parse(source));

  return config.http_service?.auto_stop_machines === 'stop' ? 'stop' : 'suspend';
}
