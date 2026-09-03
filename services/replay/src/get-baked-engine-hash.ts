declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SIM_ENGINE_HASH?: string;
    }
  }
}

export function getBakedEngineHash(): string | undefined {
  // Bun's `--define` replaces only the dot-access form of `process.env.SIM_ENGINE_HASH`; bracket
  // access reads the real environment, so this expression stays exactly as written
  return process.env.SIM_ENGINE_HASH;
}
