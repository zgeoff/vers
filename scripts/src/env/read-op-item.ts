import { $ } from 'bun';

/**
 * Reads a 1Password item as JSON via the `op` CLI. Uses `--format json` and
 * leaves the field extraction to the caller — never `op item get --fields`,
 * which CSV-quotes multiline values and corrupts PEM keys.
 */
export async function readOpItem(itemTitle: string, vault: string): Promise<unknown> {
  try {
    const result = await $`op item get ${itemTitle} --vault ${vault} --format json`.quiet();

    return JSON.parse(result.stdout.toString()) as unknown;
  } catch (error) {
    throw new Error(
      `op item get "${itemTitle}" --vault ${vault} failed — is op installed and signed in? (${toMessage(error)})`,
      { cause: error },
    );
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
