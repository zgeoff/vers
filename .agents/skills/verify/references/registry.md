# Registry paths

Read this before you add, remove or rename a glob in
[core-paths.ts](../../../../apps/web/src/test-utils/verify/core-paths.ts) or
[feature-paths.ts](../../../../apps/web/src/test-utils/verify/feature-paths.ts). The
[registry](../../../../apps/web/src/test-utils/verify/create-verify-registry.ts) reads each
feature's `paths` from `featurePaths` in `feature-paths.ts`, and `bun verify report` uses them to
set `changed: true` on a feature. `featurePaths` builds each feature's `paths` from these:

- `corePaths` in `core-paths.ts`, which holds the packages and globs that every journey runs, such
  as the web app's shell, the RPC proxy and the avatar service. Each entry has a comment on why
  every journey runs it.
- the folder of each package in the feature's `packages` list in `feature-paths.ts`, and the folder
  of each workspace package it depends on, read from each `package.json` when the file loads.
- the globs in the feature's `paths` list in `feature-paths.ts`, such as the web routes its journey
  opens.

`feature-paths.ts` also holds these lists for the whole registry:

- `sharedPaths`, which the registry passes to `.shared()`, holds the verify CLI and the stubs and
  helpers that `bun verify up` runs. `report` marks every feature changed when a changed file
  matches one.
- `ignoredPaths`, which the registry passes to `.ignore()`, holds the files that change nothing a
  journey sees, such as docs, tests and CI wiring. `report` marks no feature for a file that matches
  one, even when it matches the other lists too.

`bun verify gate`, which CI runs on each PR but a release or Renovate PR, fails on a changed file
that matches no list.

1. Put each path in the list for the journeys it reaches:
   - Add a path that one journey, or a few, reach to the `packages` or `paths` of those features.
   - Add a path that every journey reaches to `corePaths`, with a comment on why.
   - Add a path that you can't trace to a journey to `corePaths`. An extra journey run costs less
     than a missed feature.
2. Name a service or a lib in `packages` by its folder, such as `services/email`, so its workspace
   dependencies join the feature. For the web app, use a glob in `paths`, because its `package.json`
   depends on nearly every contract and lib. When you delete a package that a feature reaches only
   through another package's dependencies, add its folder to that feature's `packages`: the walk
   reads the `package.json` files in your tree, and finds no deleted one.
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

   Fix the glob or the entry that the failure names, and run the test again. When a sample file
   flags other features because you moved a path on purpose, change the sample's expected features
   in the test.
