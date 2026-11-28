// What every verify feature holds, so a change to any of it flags them all. When you can't tell
// whether a path reaches a feature, add it here: a missed feature costs more than a journey.
export const corePaths = {
  // Package folders that every journey runs, each with the workspace packages it depends on.
  packages: [
    // public-smoke's anonymous RPC call, and the active avatar that every game page reads
    'services/avatar',

    // the proxy reads this contract on every RPC call, public-smoke's included
    'contracts/activity',

    // the landing page's loader and the proxy's session check load these clients, signed out too
    'contracts/user',
    'contracts/session',

    // the router reads the scene state on every page
    'libs/game/game-rendering',

    // `up` writes the local engine's sim version before any journey
    'libs/data/sim-registry',
  ],

  // Globs that skip the dependency walk: the web app's `package.json` depends on every contract
  // and most libs, but each page loads only what its routes import.
  globs: [
    // shared code that every service or every page imports
    'libs/core/{flags,trace,utils}/**',
    'libs/design/**',
    'libs/service/product-analytics/**',

    // the third-party packages that every process loads, patched
    'patches/**',

    // the web app's package files and build config, its entry points and its server
    'apps/web/*',
    'apps/web/public/**',
    'apps/web/src/*',
    'apps/web/src/{components,mocks,server}/**',

    // the code that every request or every page runs: the RPC proxy, sessions, queries and the
    // scene that the router picks
    'apps/web/src/lib/*',
    'apps/web/src/lib/{account,auth,forms,metrics,offline,product-events,proxy,qa-seed,query,rpc,scene,session,validation}/**',

    // the root route, the health route that `doctor` checks, and the API routes
    'apps/web/src/routes/{__root.tsx,health.ts}',
    'apps/web/src/routes/api/**',

    // the pages that no journey opens
    'apps/web/src/routes/{account_.2fa.verify,account_.change-email,account_.change-password,forgot-password,reset-password,reset-password-started}.tsx',
    'apps/web/src/routes/{-account,-account-2fa-verify,-account-change-email,-account-change-password,-forgot-password,-reset-password}/**',
    'apps/web/src/routes/_game/{avatar,codex,market,market.listing.$listingID,settings,stash}.tsx',
    'apps/web/src/routes/{-avatar,-codex,-market,-market-listing,-settings,-stash}/**',
  ],
} as const;
