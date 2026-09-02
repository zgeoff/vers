import * as z from 'zod';

const flyConfigSchema = z.looseObject({
  env: z.record(z.string(), z.unknown()).optional(),
});

export async function readFlyEnvKeys(configDir: string): Promise<Array<string>> {
  const source = await Bun.file(`${configDir}/fly.toml`).text();

  const config = flyConfigSchema.parse(Bun.TOML.parse(source));

  return Object.keys(config.env ?? {});
}
