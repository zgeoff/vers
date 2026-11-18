# Registry paths

Read this before you add, remove or rename a glob in
[feature-paths.ts](../../../../apps/web-e2e/src/verify/feature-paths.ts). The
[registry](../../../../apps/web-e2e/src/verify/create-verify-registry.ts) reads its globs from that
file, and `bun verify report` uses them to set `changed: true` on a feature.

The file holds three lists:

- `featurePaths`: each feature's `paths`. `report` marks the feature changed when a changed file
  matches one.
- `sharedPaths`: the verify CLI and the stubs and helpers that `bun verify up` runs. `report` marks
  every feature changed when a changed file matches one.
- `ignoredPaths`: the registry's `.ignore` list, for files that change nothing a journey sees, such
  as docs, tests and CI wiring. `report` marks no feature for a file that matches one, even when it
  matches the other lists too.

The gate fails on a changed file that matches none of the three lists.

1. Edit the glob in the list it belongs to.
2. For each glob you add to `featurePaths` or `sharedPaths`, add an entry to
   [skill-gate.json](../../../../.claude/skill-gate.json), such as
   `{ "match": "apps/<name>/**", "skills": ["verify"] }`. With the entry, an agent must load this
   skill before it edits a matching file. For a glob you rename, rename its entry. For a glob you
   remove, delete its entry.
3. Run `bun test apps/web-e2e/src/verify/feature-paths.test.ts`. Expect: the test passes. It fails
   on each glob in `featurePaths` or `sharedPaths` that no `verify` entry matches. It misses an
   entry left behind after you remove a glob.
