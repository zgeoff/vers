declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SIM_ENGINE_HASH?: string;
    }
  }
}

/**
 * Reads the engine hash through a literal `process.env.SIM_ENGINE_HASH` expression so a binary
 * compiled with `--define "process.env.SIM_ENGINE_HASH='<hash>'"` returns the baked value even when
 * the runtime environment carries no such variable. Only the dot-access form is define-replaced —
 * bracket access reads the real environment — so this expression must stay exactly as written.
 * Uncompiled runs (dev, tests) read the real environment through the same expression.
 */
export function getBakedEngineHash(): string | undefined {
  return process.env.SIM_ENGINE_HASH;
}
