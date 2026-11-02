# Boundaries

Find the boundary your code talks to in this table, and give the test what the table names. Use the
real thing wherever the table says so.

| Boundary                                                            | The test uses                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| A CLI the code runs, its own or another, such as `git`              | The real binary, spawned                                       |
| A shell script                                                      | The real script, through Bun's `$` ([Shell](./shell.md))       |
| The filesystem                                                      | A real `mkdtemp` tree per test                                 |
| A database                                                          | The real engine, isolated per test ([Database](./database.md)) |
| A remote HTTP or RPC service                                        | MSW handlers ([HTTP mocking](./http.md))                       |
| A service that runs in a container, such as Redis                   | The real service in a container                                |
| An SDK client that sends command objects, such as an AWS SDK client | A stand-in `send`                                              |
| A worker the repo spawns and talks to over its own messages         | A stateful stand-in ([System tests](./system-tests.md))        |

## Stand-ins

- Never stub `fetch` or an HTTP client. Mock the remote server with MSW, so the code's own request
  code runs.
- When the code builds an SDK client or another dependency itself, change it to take the dependency
  from its caller. Then pass the stand-in in.
- Never spy on a real method to make it fail.
- Put each stand-in in `test-utils/`, and name the file for what it does:
  - `start-stub-<thing>.ts` starts a process or a server that keeps running;
  - `create-stub-<thing>.ts` creates a resource on disk or in a service;
  - `run-stub-<thing>.ts` is an executable script;
  - `build-stub-<thing>.ts` returns a value, such as a stand-in `send`.
- In a stand-in's own tests, check each thing it assumes about the real program against a response
  recorded from that program.

## Containers

When a test needs a container, probe for Docker at module level, and read the value only in
`skipIf`. Search `test-utils/` for a probe before you write one. Bun reads `skipIf` before the test
runs, so `setupTest()` can't make the value. Say so in a comment:

```ts
// skipIf reads this before the test runs, so setupTest() can't make it.
const hasDocker = await probeDocker();
```

## Failure branches

Reach a failure branch with a real failure: an address where nothing listens, an MSW handler that
returns the error, or a conflicting row. When no real failure reaches the branch, pass the code a
stand-in that throws.

To test how code recovers after several calls fail, turn each call's rejection into a value with
`.then(() => null, (error: unknown) => error)`. Then assert the list of errors and the final state
in the same test. A rejection left as a rejection stops the test at the first failed call.

## Module mocks

When you want to mock a module only because a module it imports does work as it loads, move that
work out of the imported module, or pass that dependency in.

Write a module mock only for one of these, in its own file, `register-<module>-mock.ts`, that the
test preload loads:

- an API the runtime lacks, such as WebGL, whose answers a test sets through one exported setter;
- a test wrapper that the library's own docs give, such as the zustand mock that resets each store
  after a test.
