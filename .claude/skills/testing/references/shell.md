# Shell script testing

A shell script's test is a `bun:test` file beside the script, `<script>.test.ts`, that runs the real
script through Bun's `$` shell, and ShellCheck is the script's static check. One runner keeps every
rule in [SKILL.md](../SKILL.md) in force for shell scripts, its timeouts, reports, and lanes
included, with no second tool to keep up. A bats or ShellSpec suite and a hand-written runner, such
as a `test-*.sh` file that runs cases and counts failures, never appear.

## Running the script

A test calls the script through `$` this way:

- Name the interpreter and the script path in the command, as in
  `` $`bash ${ctx.scriptPath} ${ref}` ``. Take the path from `import.meta.url` or `import.meta.dir`.
- Pass each argument as an interpolated value. Bun escapes it, so a value with a space, a `;`, or a
  `$` reaches the script as one argument, and an array becomes one argument per element. Never build
  the command line as a string, and never interpolate `{ raw: … }`.
- Chain `.nothrow()`, so a nonzero exit returns its result instead of throwing, and `.quiet()`, so
  the script's output stays out of the test run's output.
- Set the working directory with `.cwd(dir)` and the environment with `.env({ … })`. `.env()`
  replaces the whole environment, so spread `process.env` or a clean env into it.
- Feed standard input with a redirect from a `Response`:
  `` $`bash ${path} < ${Response.json(files)}` ``.
- Run a setup command, such as `git init`, through `$` without `.nothrow()`, so a failed setup
  throws where it fails instead of surfacing as a wrong result later.

`stdout` and `stderr` are buffers, so read them with `.toString()` before a string matcher.

## Programs the script calls

A program the script calls that the test cannot run, such as `gh` against GitHub, gets a stub
executable in a folder that the test puts first on the script's `PATH`. A script takes the time
argument that [Time and waiting](../SKILL.md#time-and-waiting) asks for as an environment variable,
such as its poll interval, and the test sets it.

## ShellCheck

CI runs ShellCheck over every `.sh` file that git tracks, and the pre-push baseline runs it over the
`.sh` files that a branch changes. Fix a finding in the script. A disable directive is the
exception: it names the code and gives its reason on the same line, as in
`# shellcheck disable=SC2053 # the pattern is a glob on purpose`.

## Example

A made-up `tag-release.sh` takes a version and exits 2 on one that is not a version. The test shows
the shell-specific parts: an argument with a space stays one argument, `.nothrow()` keeps the exit
code, and `.toString()` reads the output. Its assertions follow
[Assertions](../SKILL.md#assertions).

```ts
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { $ } from 'bun';

test('it refuses a version with a space in it', async () => {
  const result = await $`bash ${join(import.meta.dir, 'tag-release.sh')} ${'1.2 beta'}`
    .nothrow()
    .quiet();

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: "tag-release: '1.2 beta' is not a version\n",
  });
});
```
