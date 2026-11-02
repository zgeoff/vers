import { runPulumiStack } from '../infra/run-pulumi-stack';

// Runs inside `op run`, which resolves the state bucket and the Cloudflare account into env, and
// runs the Pulumi command in its arguments on the prod stack of the program in the working
// directory.

process.exitCode = await runPulumiStack({
  args: process.argv.slice(2),
  cwd: process.cwd(),
  env: process.env,
});
