# Registry paths

Read this before you add, remove or rename a glob in
[core-paths.ts](../../../../apps/web/src/test-utils/verify/core-paths.ts) or
[feature-paths.ts](../../../../apps/web/src/test-utils/verify/feature-paths.ts). The
[registry](../../../../apps/web/src/test-utils/verify/create-verify-registry.ts) reads each
feature's `paths` from `feature-paths.ts`, and `bun verify report` uses them to set `changed: true`
on a feature.

Each feature's `paths` holds three parts:

- the core list in `core-paths.ts`: the packages and globs that every journey runs, such as the web
  app's shell, the RPC proxy and the avatar service. Each entry has a comment that says why every
  journey runs it.
- the folder of each package the feature names in `feature-paths.ts`, and the folder of each
  workspace package it depends on, read from each `package.json` when the file loads.
- the feature's own globs in `feature-paths.ts`, such as the web routes its journey opens.

`feature-paths.ts` also holds two lists for the whole registry:

- `sharedPaths`: the verify CLI and the stubs and helpers that `bun verify up` runs. `report` marks
  every feature changed when a changed file matches one.
- `ignoredPaths`: the registry's `.ignore` list, for files that change nothing a journey sees, such
  as docs, tests and CI wiring. `report` marks no feature for a file that matches one, even when it
  matches the other lists too.

The gate fails on a changed file that matches no list.

1. Put a path where it reaches:
   - a path that one journey, or a few, reach: the `packages` or `paths` of those features;
   - a path that every journey reaches: the core list, with a comment that says why;
   - a path that you can't trace to a journey: the core list. A missed feature costs more than a
     journey.
2. Name a service or a lib in `packages` by its folder, such as `services/email`, so its workspace
   dependencies join the feature. Use a glob in `paths` for the web app: its `package.json` depends
   on nearly every contract and lib.
3. For each glob you add to `featurePaths` or `sharedPaths`, check that an entry in
   [skill-gate.json](../../../../.claude/skill-gate.json) matches it, such as
   `{ "match": "apps/web/**", "skills": ["verify"] }`. With the entry, an agent must load this skill
   before it edits a matching file. For a glob you remove, delete an entry that only it used.
4. Run `bun test apps/web/src/test-utils/verify/feature-paths.test.ts`. Expect: the test passes. It
   fails when:
   - a glob in `featurePaths` or `sharedPaths` has no `verify` entry in `skill-gate.json`;
   - a sample file flags other features than the test expects;
   - a tracked file matches no feature and no ignore glob;
   - a service, contract or lib folder flags no feature.
