import type { EnvRow, EnvSchemaLike } from './types';

/**
 * Probes each schema with `undefined` to classify it: a rejection is a required variable, an
 * accepted `undefined` is optional, and an accepted concrete value is that variable's default.
 */
export function buildEnvRows(shape: Readonly<Record<string, EnvSchemaLike>>): Array<EnvRow> {
  return Object.entries(shape)
    .map(([key, schema]) => {
      const probe = schema.safeParse(undefined);

      return {
        defaultValue:
          probe.success && probe.data !== undefined ? formatDefault(probe.data) : undefined,
        description: schema.description ?? schema.meta?.()?.description ?? '',
        key,
        required: !probe.success,
      };
    })
    .toSorted((a, b) => a.key.localeCompare(b.key));
}

function formatDefault(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value) ?? '';
}
