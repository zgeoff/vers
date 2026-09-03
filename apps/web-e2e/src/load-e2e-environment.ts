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
  readonly appWebEnv?: Readonly<Record<string, string>>;
}

export function loadE2EEnvironment(options: Readonly<LoadE2EEnvironmentOptions>): E2EEnvironment {
  // resolve the project root without relying on `__dirname`, which is unreliable when a config is
  // parsed for the task graph rather than run from its own directory
  const projectRoot = process.cwd().includes('web-e2e')
    ? process.cwd()
    : `${process.cwd()}/apps/web-e2e`;

  const appWebRoot = path.resolve(projectRoot, '..', 'web');

  // the .env load runs before any env read below, so a BASE_URL defined in the file is honored the
  // same as every other key
  try {
    process.loadEnvFile(path.join(projectRoot, '.env'));
  } catch (error) {
    // only a missing .env is fine (CI writes one from a secret; the smoke spec needs no secrets) —
    // a present-but-unreadable file is a real configuration fault and must not be swallowed
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  const baseURL = process.env['BASE_URL'] ?? 'http://localhost:3000';

  return {
    baseURL,
    projectRoot,
    webServer: [
      {
        // the stateful mock backends as real HTTP listeners on the service dev ports the artifact's
        // SERVICE_URLS defaults resolve. Never reuse an already-listening server: it could be the
        // real dev stack, which specs must never mutate.
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
        // the deployable artifact exactly as built, never rebuilt here: the e2e turbo task depends
        // on the app's build task. Never reuse an already-listening server: whatever answers on
        // this port is not the artifact, and reusing it voids the production-build guarantee.
        command: 'node ./server.mjs',
        cwd: appWebRoot,
        env: {
          // canvas-persistence.spec.ts clicks through to the Market nav link
          FEATURE_MARKET: 'true',

          LOGGING: 'warn',
          NODE_ENV: 'production',

          // production sets this, and the server only registers OpenTelemetry when it is set, so
          // the boot the specs exercise takes the same path as Fly's. Nothing listens on the port:
          // the exporters drop what they cannot deliver and never block boot.
          OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1',
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
