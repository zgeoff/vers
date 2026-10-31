import { runPulumiPreview } from '../infra/run-pulumi-preview';

// Runs inside `op run`, which resolves the state bucket and the Cloudflare account into env, and
// previews the prod stack of the Pulumi program in the working directory.

process.exitCode = await runPulumiPreview({ cwd: process.cwd(), env: process.env });
