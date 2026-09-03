import fs from 'node:fs/promises';
import path from 'node:path';

export async function writeEnvFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, { mode: 0o600 });

  // a pre-existing file keeps its mode through a plain writeFile regardless of the umask
  await fs.chmod(filePath, 0o600);
}
