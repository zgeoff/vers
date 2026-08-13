import path from 'node:path';

interface WebServerEntry {
  readonly command: string;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly reuseExistingServer: boolean;
  readonly stderr: 'pipe';
  readonly stdout: 'pipe';
  readonly timeout: number;
  readonly url: string;
}

interface E2EEnvironment {
  readonly baseURL: string;
  readonly projectRoot: string;
  readonly webServer: ReadonlyArray<WebServerEntry>;
}

interface LoadE2EEnvironmentOptions {
  /**
   * Extra env keys for the app-web server beyond the shared set — the default config forces the
   * placeholder canvas with `FEATURE_GAME_RENDERER: 'false'`; benchmark runs omit it to measure
   * the real WebGPU/R3F canvas.
   */
  readonly appWebEnv?: Readonly<Record<string, string>>;
}

/**
 * The environment pieces every playwright config in this package shares: the resolved roots, the
 * `.env` load, and the two web servers. Config-specific knobs (testDir, outputDir, timeouts,
 * projects) stay in each config file; the server topology lives here once so the configs cannot
 * drift apart.
 */
export function loadE2EEnvironment(options: Readonly<LoadE2EEnvironmentOptions>): E2EEnvironment {
  const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';

  // resolve the project root without relying on `__dirname`, which is unreliable when a config is
  // parsed for the task graph rather than run from its own directory
  const projectRoot = process.cwd().includes('web-e2e')
    ? process.cwd()
    : `${process.cwd()}/apps/web-e2e`;

  const appWebRoot = path.resolve(projectRoot, '..', 'web');

  try {
    process.loadEnvFile(path.join(projectRoot, '.env'));
  } catch {
    // no .env locally (CI writes one from a secret) — the smoke spec that runs without a .env
    // needs no secrets
  }

  return {
    baseURL,
    projectRoot,
    webServer: [
      {
        // the stateful mock backends as real HTTP listeners on the service dev ports the
        // artifact's SERVICE_URLS defaults resolve. Never reuse an already-listening server: a
        // service answering on these ports could be the real dev stack, and specs must never
        // mutate it.
        command: 'bun src/serve-mock-services.ts',
        cwd: projectRoot,
        reuseExistingServer: false,
        stderr: 'pipe',
        stdout: 'pipe',
        timeout: 60 * 1000,

        // the same override-then-default resolution the spawned listeners apply per service
        url: `${process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003'}/health`,
      },
      {
        // every spec runs against the deployable artifact, exactly as built — no mock backend
        // in-process, no build-time env overrides. Serving it here must not rebuild it: the e2e
        // turbo task depends on the app's build task, and any other entrypoint builds first.
        // Downstream service calls leave the process over HTTP and land on the mock listeners
        // above. Never reuse an already-listening server: whatever answers on this port (a
        // leftover vite dev, another app) is not the artifact, and reusing it silently voids the
        // production-build guarantee.
        command: 'node ./server.mjs',
        cwd: appWebRoot,
        env: {
          // canvas-persistence.spec.ts clicks through to the Market nav link
          FEATURE_MARKET: 'true',

          LOGGING: 'warn',
          NODE_ENV: 'production',
          PORT: new URL(baseURL).port,

          // Start's session sealing rejects any password under 32 characters
          SESSION_SECRET: 'e2e-session-secret-32-characters',

          ...options.appWebEnv,
        },
        reuseExistingServer: false,
        stderr: 'pipe',
        stdout: 'pipe',
        timeout: 240 * 1000,
        url: `${baseURL}/health`,
      },
    ],
  };
}
