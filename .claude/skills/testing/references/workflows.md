# Workflow testing

A GitHub Actions step's logic lives in a script, and the script's tests are the step's tests. The
ci-design skill's [Step scripts](../../ci-design/SKILL.md#step-scripts) section owns where a script
lives, what a `run:` may hold, and the workflow lint that checks both. This reference owns how the
logic and the workflow files get tested.

## Test the step through its script

Call the script with the values that the step passes through `env:` and its arguments, so the test
runs the logic on the inputs a real run gives it.

## Repo fact tests

A repo fact test is the only test that reads a workflow file. It checks the workflow against data
that the repo owns elsewhere, such as a CI matrix against the list of suites that a script defines,
so the two cannot drift. It parses the file with `Bun.YAML.parse` and checks the values with plain
assertions. A rule that holds for every repo, such as a job's timeout or a cancel setting, belongs
in the workflow lint, and a repo never tests a shared lint rule, as [SKILL.md](../SKILL.md) states.

A made-up repo keeps its end-to-end suites in `e2e/suites.ts` and runs one matrix job per suite:

```ts
import { suites } from '../e2e/suites.ts';

test('it runs one e2e matrix job for each suite the e2e runner defines', async () => {
  const text = await Bun.file(new URL('../.github/workflows/ci.yml', import.meta.url)).text();
  const workflow: unknown = Bun.YAML.parse(text);

  expect(workflow).toMatchObject({
    jobs: { e2e: { strategy: { matrix: { suite: suites.map((suite) => suite.name) } } } },
  });
});
```

## What a workflow test never does

Each of these tests GitHub's behaviour or pins the file's shape, and either fails on a change that
breaks nothing:

- **Pull a step's `run:` text out of the YAML and run it.** Move the logic into a script and test
  the script.
- **Snapshot the layout**, such as the ordered list of a workflow's jobs or a job's steps.
- **Emulate the scheduler, the triggers or `if:` evaluation.** GitHub owns that behaviour, and a
  copy of it only agrees with itself.
