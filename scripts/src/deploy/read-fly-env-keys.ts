import * as z from 'zod';

const flyConfigSchema = z.looseObject({
  env: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Reads the plain-env key names a target's `fly.toml` `[env]` table sets on its machines; an
 * absent table reads as no keys.
 */
export async function readFlyEnvKeys(configDir: string): Promise<Array<string>> {
  const source = await Bun.file(`${configDir}/fly.toml`).text();

  const config = flyConfigSchema.parse(Bun.TOML.parse(source));

  return Object.keys(config.env ?? {});
}
