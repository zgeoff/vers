import { requireEnvVar } from '../utils/require-env-var';
import { runVerifyGate } from '../verify-gate/run-verify-gate';

// The `verify / gate` check's step, which verify.yml runs on each pull_request event.

process.exitCode = await runVerifyGate({
  eventPath: requireEnvVar('GITHUB_EVENT_PATH', 'the gate reads the pull request from the event'),
  tempDirectory: requireEnvVar('RUNNER_TEMP', 'the gate writes the body to a file there'),
});
