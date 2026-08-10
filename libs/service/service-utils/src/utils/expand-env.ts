interface Env {
  NODE_ENV: 'development' | 'e2e' | 'production' | 'test';
}

/**
 * Composes with a Zod env schema as its `.transform(expandEnv)` step.
 */
export function expandEnv<T extends Env>(env: T) {
  return {
    ...env,
    isDevelopment: env.NODE_ENV === 'development',
    isE2E: env.NODE_ENV === 'e2e',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  };
}
