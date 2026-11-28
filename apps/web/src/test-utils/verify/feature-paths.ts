import { join } from 'node:path';
import { collectReachedFolders } from './collect-reached-folders';
import { corePaths } from './core-paths';
import { readWorkspacePackages } from './read-workspace-packages';
import type { FeatureReach, WorkspacePackage } from './types';

// Globs are root-relative, as `git ls-files` prints them, and match with Bun.Glob. A service boots,
// and a route file loads, in every journey, so a change that breaks either fails every journey,
// though it flags only the features whose journeys use it.
const workspace = await readWorkspace(join(import.meta.dir, '..', '..', '..', '..', '..'));

// Every journey but public-smoke signs in and plays on a game page, which mounts the game world,
// the world map and the idle worker, and reads the session, the user and the current activity.
const gamePages: FeatureReach = {
  packages: [
    'services/session',
    'services/user',
    'services/activity',

    // the activity service reads each run's seeds from it
    'services/keys',
    'libs/game/idle-client',
    'libs/game/worldmap-client',
  ],
  paths: [
    'apps/web/src/routes/{_game.tsx,_game/explore.tsx}',
    'apps/web/src/routes/{-game,-explore}/**',
    'apps/web/src/lib/{activity,avatar,idle,qa,worldmap}/**',
  ],
};

const avatarCreate: FeatureReach = {
  packages: [],
  paths: ['apps/web/src/routes/_game/avatars_.create.tsx', 'apps/web/src/routes/-avatar-create/**'],
};

// The run journeys start a run from a map node. `Click to start` opens the current run, which
// moves to `/activity`, and each checkpoint wakes the replay service, which can reject the run.
const runStart: FeatureReach = {
  packages: ['services/replay'],
  paths: [
    'apps/web/src/routes/_game/{explore.node.$nodeID,explore_.current,activity}.tsx',
    'apps/web/src/routes/{-explore-node,-explore-current,-activity}/**',
  ],
};

// Each feature holds `corePaths`, the folders of its packages and of the workspace packages they
// depend on, from each `package.json` as this file loads, and its own web files.
export const featurePaths = {
  'public-smoke': buildFeatureGlobs(workspace, {
    packages: [],
    paths: ['apps/web/src/routes/index.tsx', 'apps/web/src/routes/-home/**'],
  }),
  signup: buildFeatureGlobs(
    workspace,
    joinReaches(gamePages, avatarCreate, {
      // the welcome email and its code
      packages: ['services/email', 'services/verification'],
      paths: [
        'apps/web/src/routes/{signup,verify-otp,onboarding}.tsx',
        'apps/web/src/routes/{-signup,-verify-otp,-onboarding}/**',
      ],
    }),
  ),
  'avatar-roster': buildFeatureGlobs(
    workspace,
    joinReaches(gamePages, avatarCreate, {
      packages: [],
      paths: ['apps/web/src/routes/_game/avatars.tsx', 'apps/web/src/routes/-avatars/**'],
    }),
  ),
  'offline-run': buildFeatureGlobs(workspace, joinReaches(gamePages, runStart)),
  'device-takeover': buildFeatureGlobs(
    workspace,
    joinReaches(gamePages, runStart, {
      // each sign-in reads the user's two-factor state
      packages: ['services/verification'],
      paths: [
        'apps/web/src/routes/{login,login_.force-logout}.tsx',
        'apps/web/src/routes/{-login,-login-force-logout}/**',

        // the confirmed takeover lands the second device on `/respite`
        'apps/web/src/routes/_game/respite.tsx',
        'apps/web/src/routes/-respite/**',
      ],
    }),
  ),
} as const satisfies Record<string, ReadonlyArray<string>>;

interface Workspace {
  readonly packages: ReadonlyArray<WorkspacePackage>;
  readonly coreFolders: ReadonlyArray<string>;
  readonly coreGlobs: ReadonlyArray<string>;
}

function buildFeatureGlobs(workspaceFacts: Workspace, reach: FeatureReach): Array<string> {
  // the test libraries that a service imports sit in the shared list or the ignore list
  const ownFolders = collectReachedFolders(reach.packages, workspaceFacts.packages).filter(
    (folder) => !workspaceFacts.coreFolders.includes(folder) && !folder.startsWith('libs/testing/'),
  );

  return [
    ...workspaceFacts.coreGlobs,
    ...ownFolders.map((folder) => `${folder}/**`),
    ...reach.paths,
  ];
}

async function readWorkspace(rootDir: string): Promise<Workspace> {
  const packages = await readWorkspacePackages(rootDir);

  const coreFolders = collectReachedFolders(corePaths.packages, packages);

  return {
    packages,
    coreFolders,
    coreGlobs: [...coreFolders.map((folder) => `${folder}/**`), ...corePaths.globs],
  };
}

function joinReaches(...reaches: ReadonlyArray<FeatureReach>): FeatureReach {
  return {
    packages: reaches.flatMap((reach) => reach.packages),
    paths: reaches.flatMap((reach) => reach.paths),
  };
}

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

  // 4. Code that no journey runs: the apps beside the game, and the release registry that only
  //    the deploy scripts read.
  'apps/bugsink/**',
  'apps/umami/**',
  'libs/data/release-registry/**',
] as const;
