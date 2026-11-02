# Container builds

Each server image that a [deploy](./deployment.md) rolls out is built from its app's Dockerfile.

## Dockerfiles

Fly's remote builder builds every server image from the app's Dockerfile. Every domain service
builds from the one service Dockerfile, and the service's folder name reaches it as the `SERVICE`
build arg from the app's `fly.toml` and from its compose service. Each Dockerfile opens with a prune
stage that cuts the workspace to the target's dependency graph with `turbo prune`, and its later
stages install, build, and assemble a minimal runtime. The install stages run a frozen install from
the pruned manifests and the pruned lockfile, so the build fails when bun resolves the smaller
workspace differently from the lockfile that turbo wrote. That round trip depends on the turbo
release, because older releases kept the root workspace's hoisting choices in the pruned lockfile
(turborepo#11007). The prune stage therefore runs the turbo version from the workspace catalog. The
[deploy pipeline](./deployment.md#pipeline) builds the images only after a merge, so a pull request
that changes a Dockerfile, a package manifest, the lockfile, or a patch builds every server image in
the PR checks.

## Runtimes

Every domain service compiles to a Bun executable and runs it on `alpine` as `nobody`, with no
`node_modules` and no source. The build compiles each entrypoint a service has into its own binary,
so two images carry more than the server binary:

- The email service's image carries the sweep binary its scheduled machine runs
  ([queues](./queues.md)).
- The replay service's image carries the drain binary its scheduled machine runs, and the provider
  binary that each per-version replay provider app runs
  ([sim-version registry](../game/replay-verification.md#sim-version-registry)).

The web app bundles an SSR server instead of a Bun executable: a full install with dev dependencies
for the build, then a production-only install with the hoisted linker, so the SSR bundle resolves
every runtime import from one flat `node_modules`. Its server entry carries no top-level `await`,
because a dynamically imported chunk can import the entry back and Node exits on the unsettled
cycle.
