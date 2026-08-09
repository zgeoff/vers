import { runContentPublish } from '../content/run-content-publish';

const filePath = process.argv.at(2);

if (filePath === undefined) {
  console.error('usage: bun run content:publish <path-to-content-document.json>');
  process.exit(1);
}

const databaseURL = process.env['DATABASE_URL'];

if (databaseURL === undefined) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

try {
  const result = await runContentPublish({ databaseURL, filePath });

  console.log(`published content version ${result.contentVersion} and moved the current pointer`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exit(1);
}
