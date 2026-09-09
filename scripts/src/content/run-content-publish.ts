import { createContentVersion } from '@vers/content-registry';
import { createDB } from '@vers/db';
import { findCurrentSimVersion } from '@vers/sim-registry';
import { findContentCoverageGap } from '../deploy/find-content-coverage-gap';
import { parseContentDocumentSource } from './parse-content-document-source';

interface RunContentPublishInput {
  readonly databaseURL: string;
  readonly filePath: string;
}

export async function runContentPublish(
  input: Readonly<RunContentPublishInput>,
): Promise<{ contentVersion: string }> {
  const text = await Bun.file(input.filePath).text();

  const result = parseContentDocumentSource(text);

  if (result.kind !== 'ok') {
    throw new Error(result.message);
  }

  const db = createDB({ databaseURL: input.databaseURL });

  try {
    // the publish refuses to move the current pointer past what the active engine replays, the
    // same ordering the deploy preflight asserts from the other side
    const engine = await findCurrentSimVersion(db);

    const gap = findContentCoverageGap({
      contentVersion: result.document.contentVersion,
      maxContentVersion: engine?.maxContentVersion,
    });

    if (gap !== null) {
      throw new Error(`refusing to publish: ${gap}`);
    }

    await createContentVersion(db, result.document);
  } finally {
    await db.destroy();
  }

  return { contentVersion: result.document.contentVersion };
}
