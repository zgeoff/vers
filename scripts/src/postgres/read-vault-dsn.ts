import { execa } from 'execa';

/**
 * Reads a DSN field from the 1Password vers vault via the op CLI, which
 * authenticates with the OP_SERVICE_ACCOUNT_TOKEN loaded from the
 * environment.
 */
export async function readVaultDSN(item: 'neon-mcp-dev' | 'neon-mcp-ro'): Promise<string> {
  try {
    const result = await execa('op', ['read', `op://vers/${item}/dsn`]);

    return result.stdout.trim();
  } catch (error) {
    throw new Error(
      `failed to read op://vers/${item}/dsn — is the op service-account token present and unexpired?`,
      { cause: error },
    );
  }
}
