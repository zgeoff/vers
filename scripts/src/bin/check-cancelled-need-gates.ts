import { z } from 'zod';
import { collectRunsAfterCancelledNeed } from '../ci/collect-runs-after-cancelled-need';
import { collectSkipsAfterTimedOutNeed } from '../ci/collect-skips-after-timed-out-need';
import { parseWorkflowJobs } from '../ci/parse-workflow-jobs';

const WORKFLOW_GLOB = '.github/workflows/*.yml';
let failed = false;

for await (const path of new Bun.Glob(WORKFLOW_GLOB).scan()) {
  const text = await Bun.file(path).text();

  const document: unknown = Bun.YAML.parse(text);
  const parsed = parseWorkflowJobs(document);

  if (!parsed.success) {
    console.error(`✗ ${path} holds a job this check cannot read: ${z.prettifyError(parsed.error)}`);

    failed = true;
    continue;
  }

  for (const run of collectRunsAfterCancelledNeed(parsed.data)) {
    console.error(`✗ ${path}: ${run.job} runs after ${run.cancelledJob} is cancelled`);

    failed = true;
  }

  for (const skip of collectSkipsAfterTimedOutNeed(parsed.data)) {
    console.error(
      `✗ ${path}: failure handler ${skip.job} skips when ${skip.timedOutJob} times out`,
    );

    failed = true;
  }
}

if (failed) {
  console.error(
    "skip each job after a cancelled need: list the need and refuse its 'cancelled' result in the job's if:",
  );

  console.error(
    "run each failure handler on a 'cancelled' need too, and drop the run there when a newer run exists",
  );

  process.exitCode = 1;
} else {
  console.log(
    `✓ no job in ${WORKFLOW_GLOB} runs after a need that its concurrency group cancels, and each failure handler runs when a need times out`,
  );
}
