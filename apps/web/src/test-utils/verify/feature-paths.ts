// Globs are root-relative, as `git ls-files` prints them, and match with Bun.Glob. Every journey
// signs up through the web app, which calls the services, and plays through the game libraries in
// the browser, so each feature holds all of the code the local stack runs.
const everyJourney = [
  'apps/web/**',
  'services/**',
  'contracts/**',
  'libs/core/**',
  'libs/data/**',
  'libs/design/**',
  'libs/game/**',
  'libs/service/**',
  'patches/**',
] as const;

export const featurePaths = {
  'public-smoke': [...everyJourney],
  signup: [...everyJourney],
  'device-takeover': [...everyJourney],
  'offline-run': [...everyJourney],
  'avatar-roster': [...everyJourney],
} as const satisfies Record<string, ReadonlyArray<string>>;

// A change to one of these changes every feature: the verify CLI and its local stack, the e2e
// helpers and stubs the stack and the game driver run, and the QA reset that removes each account.
export const sharedPaths = [
  'apps/web/src/test-utils/verify/**',
  'apps/web/stack.env',
  'apps/web/vendor/**',
  'libs/testing/qa-account/**',
  'scripts/src/index.ts',
  'scripts/src/qa-inbox/**',
] as const;

// A path that one of these globs matches counts as no change, even where a feature's or a shared
// glob matches it too.
export const ignoredPaths = [
  // 1. No runtime effect: prose, tests and the test-only libraries and suites.
  'docs/**',
  '**/*.md',
  'AGENTS.md',
  'CLAUDE.md',
  'COPYING',
  'LICENSE',
  '**/*.test.ts',
  '**/*.test.tsx',
  'contracts/*/src/test-utils/**',
  'libs/*/*/src/test-utils/**',
  'services/*/src/test-utils/**',
  'apps/web/src/test-utils/*.{ts,tsx}',
  'apps/web/src/test-utils/factories/**',
  '**/test-setup.ts',
  '**/test-support/**',
  '**/*.stories.tsx',
  '**/.env.test',
  '**/.env.example',
  '**/.env.development.local.example',
  'apps/web/augment-bun-test.ts',
  'apps/web/reset-zustand-stores.ts',
  'libs/testing/client-test-utils/**',
  'libs/testing/load-harness/**',
  'libs/testing/mock-services/**',
  'libs/testing/service-test-utils/**',
  'libs/testing/test-utils/**',
  'apps/web/e2e/**',
  'apps/web/bench/**',
  'apps/web/docker-compose.stack.yml',
  'apps/web/.env.e2e.example',

  // 2. Build, lint, CI, deploy and editor wiring, which the local stack never reads: it runs each
  //    service from source and builds the web app itself.
  '**/tsconfig*.json',
  '**/turbo.json',
  '**/bunfig.toml',
  '**/fly.toml',
  '**/Dockerfile',
  '**/env-contract.generated.json',
  '**/.gitignore',
  '.bun-version',
  '.coderabbit.yaml',
  '.codex/**',
  '.cursorindexingignore',
  '.dockerignore',
  '.editorconfig',
  '.formatignore',
  '.git-blame-ignore-revs',
  '.gitattributes',
  '.gitleaks.toml',
  '.gitleaksignore',
  '.mcp.json',
  '.oxfmtrc.json',
  '.oxlintrc.json',
  '.serena/**',
  '.vscode/**',
  '.claude/**',
  '.agents/**',
  '.github/**',
  'audit-ignores.json',
  'commitlint.config.js',
  'cubic.yaml',
  'deploy.config.ts',
  'docker-compose.yml',
  'knip.json',
  'lefthook.yml',
  'renovate.json',
  'rig.config.ts',
  'secrets-manifest.json',
  'socket.yml',

  // every folder of scripts/ but qa-inbox and the package entry, which read-email imports; a new
  //    folder maps to nothing, so the gate names it
  'scripts/{bunfig.toml,clean.sh,install-shell-tools.sh,run-knip.sh,test-setup.ts}',
  'scripts/src/{bin,bugsink,checkpoint-archive,ci,content,dependencies,deploy,docs,env,git-hooks,hooks,infra,lint,migrate,mocks,postgres,qa,qa-chrome,qa-cold,restore-drill,secrets,stack,test-report,test-utils,utils,verify-gate}/**',
  'infra/**',

  // 3. The files that Renovate changes: the root catalog, each package's manifest, the lock file
  //    and the Bun pin. A dependency bump merges on green CI.
  '**/package.json',
  'bun.lock',

  // 4. Apps that no journey runs.
  'apps/bugsink/**',
  'apps/umami/**',
] as const;
