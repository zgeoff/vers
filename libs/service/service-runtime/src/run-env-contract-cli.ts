import { readFile, writeFile } from 'node:fs/promises';
import type * as z from 'zod';
import type { EnvContract } from './build-env-contract';
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
 * The codegen entrypoint each service delegates to: derives the service's env contract and writes
 * `env-contract.generated.json` into `dir`, or with `--check` in `args` compares the derived
 * contract against the committed artifact instead, reporting staleness on stderr.
 * Both modes compare parsed key lists, not artifact text, so the repo formatter may restyle the
 * file freely; an equivalent artifact is also never rewritten.
 * Returns the process exit code — 1 when a check finds the artifact stale or missing, else 0.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a ZodType-bearing shape; zod schemas have no readonly form
export async function runEnvContractCLI(options: RunEnvContractCLIOptions): Promise<number> {
  const fileURL = new URL('env-contract.generated.json', options.dir);

  const contract = buildEnvContract(options.envShape);

  const committed = await readCommittedContract(fileURL);

  if (committed !== null && compareEnvContract(committed, contract)) {
    return 0;
  }

  if (options.args.includes('--check')) {
    console.error(
      `${fileURL.pathname} does not match the service's env shape — run \`bun run env:contract\` and commit the result`,
    );

    return 1;
  }

  await writeFile(fileURL, renderEnvContract(contract));

  return 0;
}

async function readCommittedContract(fileURL: URL): Promise<string | null> {
  try {
    return await readFile(fileURL, 'utf8');
  } catch {
    return null;
  }
}

function compareEnvContract(committed: string, contract: EnvContract): boolean {
  try {
    const parsed: unknown = JSON.parse(committed);

    return JSON.stringify(parsed) === JSON.stringify(contract);
  } catch {
    return false;
  }
}

function renderEnvContract(contract: EnvContract): string {
  const optional = renderKeyList(contract.optional);
  const required = renderKeyList(contract.required);

  return `{\n  "optional": ${optional},\n  "required": ${required}\n}\n`;
}

function renderKeyList(keys: ReadonlyArray<string>): string {
  return `[${keys.map((key) => JSON.stringify(key)).join(', ')}]`;
}
