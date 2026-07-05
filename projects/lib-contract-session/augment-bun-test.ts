// Pulls @zgeoff/bun-test-extended's jest-extended matcher augmentation into this
// package's tsc program. The package ships `.ts` source with no `.d.ts`, so the
// tsconfig `types` option can't resolve it as a type-reference directive — only a
// real import brings the `bun:test` `expect` augmentation into scope. bunfig.toml
// preloads the same module for the matching runtime matcher registration.
// oxlint-disable-next-line import/no-unassigned-import -- augments bun:test matchers, no export to bind
import '@zgeoff/bun-test-extended';
