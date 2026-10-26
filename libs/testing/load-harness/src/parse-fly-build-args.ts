import { z } from 'zod';

const buildArgsSchema = z.record(z.string(), z.string());

const flyConfigSchema = z.object({
  build: z.object({ args: buildArgsSchema.optional() }).optional(),
});

export function parseFlyBuildArgs(flyTOML: string): Readonly<Record<string, string>> {
  const flyConfig = flyConfigSchema.parse(Bun.TOML.parse(flyTOML));

  return flyConfig.build?.args ?? {};
}
