import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

interface InfraPreviewOptions {
  readonly infraPath: string;
  readonly outputPath: string;
}

interface InfraPreviewResult {
  readonly exitCode: number;
  readonly output: string;
}

const pulumiPreviewPath = path.resolve(import.meta.dirname, '../bin/pulumi-preview.ts');

// op conceals each secret it resolved in the output of the command it runs, so the output file is
// written from op's own output, never from inside the command.
export async function runInfraPreview(
  options: Readonly<InfraPreviewOptions>,
): Promise<InfraPreviewResult> {
  const result =
    await $`op run --env-file=.env.example -- bun ${pulumiPreviewPath} &> ${options.outputPath}`
      .cwd(options.infraPath)
      .nothrow();

  return { exitCode: result.exitCode, output: await readFile(options.outputPath, 'utf8') };
}
