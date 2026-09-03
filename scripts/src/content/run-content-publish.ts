import { createContentVersion } from '@vers/content-registry';
import { createDB } from '@vers/db';
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
    await createContentVersion(db, result.document);
  } finally {
    await db.destroy();
  }

  return { contentVersion: result.document.contentVersion };
}
