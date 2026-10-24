import { $ } from 'bun';

export async function readVaultDSN(item: 'neon-mcp-dev' | 'neon-mcp-ro'): Promise<string> {
  try {
    const dsn = await $`op read ${`op://vers/${item}/dsn`}`.text();

    return dsn.trim();
  } catch (error) {
    throw new Error(
      `failed to read op://vers/${item}/dsn — is the op service-account token present and unexpired?`,
      { cause: error },
    );
  }
}
