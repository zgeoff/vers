# Feature paths

The [registry](../../../../apps/web-e2e/src/verify/create-verify-registry.ts) takes each feature's
`paths`, the shared paths and the `.ignore` list from
[feature-paths.ts](../../../../apps/web-e2e/src/verify/feature-paths.ts).

When you add a glob to `paths` or the shared paths, add it to
[skill-gate.json](../../../skill-gate.json) with the `verify` skill too.
[feature-paths.test.ts](../../../../apps/web-e2e/src/verify/feature-paths.test.ts) fails until you
do.
