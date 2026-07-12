import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Writes an env file's contents at mode 600, creating parent directories as
 * needed. Chmods explicitly after write since a pre-existing file's mode
 * survives a plain `writeFile` regardless of the process umask.
 */
export async function writeEnvFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, { mode: 0o600 });
  await fs.chmod(filePath, 0o600);
}
