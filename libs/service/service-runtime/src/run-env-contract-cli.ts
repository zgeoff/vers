import { readFile, writeFile } from 'node:fs/promises';
import type * as z from 'zod';
import { buildEnvContract } from './build-env-contract';

interface RunEnvContractCLIOptions {
  readonly args: ReadonlyArray<string>;

  /**
   * Directory the artifact lives in; must end with a trailing slash so relative resolution lands
   * inside it.
   */
  readonly dir: URL;
  readonly envShape: z.ZodRawShape;
}

/**
 * The codegen entrypoint each service delegates to: renders the service's env contract and writes
 * `env-contract.generated.json` into `dir`, or with `--check` in `args` compares the rendered
 * contract against the committed artifact instead, reporting staleness on stderr.
 * Returns the process exit code — 1 when a check finds the artifact stale or missing, else 0.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a ZodType-bearing shape; zod schemas have no readonly form
export async function runEnvContractCLI(options: RunEnvContractCLIOptions): Promise<number> {
  const fileURL = new URL('env-contract.generated.json', options.dir);

  const rendered = `${JSON.stringify(buildEnvContract(options.envShape), null, 2)}\n`;

  if (!options.args.includes('--check')) {
    await writeFile(fileURL, rendered);

    return 0;
  }

  const committed = await readCommittedContract(fileURL);

  if (committed === rendered) {
    return 0;
  }

  console.error(
    `${fileURL.pathname} does not match the service's env shape — run \`bun run env:contract\` and commit the result`,
  );

  return 1;
}

async function readCommittedContract(fileURL: URL): Promise<string | null> {
  try {
    return await readFile(fileURL, 'utf8');
  } catch {
    return null;
  }
}
