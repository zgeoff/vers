interface Env {
  NODE_ENV: 'development' | 'e2e' | 'production' | 'test';
}

/**
 *
 * A reusable Zod transformer that adds environment utility properties to any
 * environment schema that includes a NODE_ENV field.
 *
 * @example
 * ```ts
 * const envSchema = z
 *   .object({
 *     NODE_ENV: z.enum(['development', 'test', 'production', 'e2e']),
 *     // ... other env vars
 *   })
 *   .transform(addEnvUtils);
 * ```
 */
export function addEnvUtils<T extends Env>(env: T) {
  return {
    ...env,
    isDevelopment: env.NODE_ENV === 'development',
    isE2E: env.NODE_ENV === 'e2e',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  };
}
