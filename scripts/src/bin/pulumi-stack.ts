import { runPulumiStack } from '../infra/run-pulumi-stack';

process.exitCode = await runPulumiStack({
  args: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
});
