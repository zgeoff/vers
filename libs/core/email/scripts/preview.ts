#!/usr/bin/env bun

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { previews } from '../src/previews';

try {
  await writePreviews(path.resolve(process.argv[2] ?? 'dist/email-preview'));
} catch (error) {
  console.error('failed to render email previews');
  console.error(error);
  process.exit(1);
}

async function writePreviews(outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });

  await Promise.all(
    previews.map(async (preview) => {
      const rendered = preview.render();

      await Promise.all([
        writeFile(path.join(outDir, `${preview.name}.html`), rendered.html),
        writeFile(path.join(outDir, `${preview.name}.txt`), rendered.plainText),
      ]);
    }),
  );

  await writeFile(path.join(outDir, 'index.html'), renderIndexPage());

  console.log(`Rendered ${previews.length} email previews to ${outDir}`);
}

function renderIndexPage(): string {
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
