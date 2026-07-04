// PostgresError is a property of the package's default export, not a named
// export of its ESM entry — a namespace import only sees it under toolchains
// that resolve the CJS entry and synthesize named exports from it, and gets
// undefined (making the instanceof throw) everywhere else
import postgres from 'postgres';

export function isPGError(error: unknown): error is postgres.PostgresError {
  return error instanceof postgres.PostgresError;
}
