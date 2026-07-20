import * as z from 'zod';

const envFileSchema = z.union([z.string(), z.array(z.string())]);
const environmentValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const environmentSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), environmentValueSchema),
]);

const composeServiceSchema = z.looseObject({
  env_file: envFileSchema.optional(),
  environment: environmentSchema.optional(),
});

const composeFileSchema = z.looseObject({
  services: z.record(z.string(), z.unknown()).optional(),
});

export interface ComposeEnvKeys {
  /**
   * `env_file` paths as written in the compose file — relative to the compose file's own
   * directory, so callers resolve them before reading.
   */
  readonly envFileRefs: ReadonlyArray<string>;
  readonly keys: ReadonlyArray<string>;
}

/**
 * Collects the env a compose service's definition supplies: inline `environment` keys plus its
 * `env_file` references. Returns null when the parsed compose document doesn't define the
 * service. Callers must parse the document with YAML merge keys enabled — stack files compose
 * shared env through `<<:` anchors.
 */
export function collectComposeEnvKeys(
  compose: unknown,
  serviceName: string,
): ComposeEnvKeys | null {
  const definition = composeFileSchema.parse(compose).services?.[serviceName];

  if (definition === undefined) {
    return null;
  }

  const service = composeServiceSchema.parse(definition);

  return {
    envFileRefs: expandEnvFileRefs(service.env_file),
    keys: collectEnvironmentKeys(service.environment),
  };
}

function expandEnvFileRefs(
  envFile: string | ReadonlyArray<string> | undefined,
): ReadonlyArray<string> {
  if (envFile === undefined) {
    return [];
  }

  if (typeof envFile === 'string') {
    return [envFile];
  }

  return envFile;
}

function collectEnvironmentKeys(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- zod-inferred union; its readonly form defeats Array.isArray narrowing
  environment: z.infer<typeof environmentSchema> | undefined,
): Array<string> {
  if (environment === undefined) {
    return [];
  }

  if (Array.isArray(environment)) {
    return environment.map((entry) => entry.split('=', 1)[0] ?? entry);
  }

  return Object.keys(environment);
}
