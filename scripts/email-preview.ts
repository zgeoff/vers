#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { oraPromise } from 'ora';
import { previews } from '../projects/lib-email-templates/src/previews';

const defaultOutDir = 'dist/email-preview';

interface PreviewArgs {
  out: string;
}

const program = new Command()
  .name('email-preview')
  .description('CLI to render every email template to static preview files')
  .option('-o, --out <dir>', 'directory to write previews into', defaultOutDir)
  .action(async ({ out }: PreviewArgs) => {
    await writePreviews(out);
  });

const spinnerConfig = {
  failText: 'Failed to render email previews',
  successText: `Rendered ${previews.length} email previews`,
  text: 'Rendering email previews...',
};

async function writePreviews(outDir: string) {
  const resolvedOutDir = path.resolve(outDir);

  await mkdir(resolvedOutDir, { recursive: true });

  await oraPromise(
    Promise.all(
      previews.map(async (preview) => {
        const { html, plainText } = await preview.render();

        await Promise.all([
          writeFile(path.join(resolvedOutDir, `${preview.name}.html`), html),
          writeFile(
            path.join(resolvedOutDir, `${preview.name}.txt`),
            plainText,
          ),
        ]);
      }),
    ),
    spinnerConfig,
  );

  await writeFile(path.join(resolvedOutDir, 'index.html'), renderIndexPage());

  console.log(`Preview index: ${path.join(resolvedOutDir, 'index.html')}`);
}

function renderIndexPage() {
  const items = previews
    .map(
      (preview) =>
        `      <li><a href="./${preview.name}.html">${preview.name}</a> (<a href="./${preview.name}.txt">plain text</a>)</li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>vers email previews</title>
  </head>
  <body>
    <h1>vers email previews</h1>
    <ul>
${items}
    </ul>
  </body>
</html>
`;
}

program.parse();
