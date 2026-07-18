import { refreshReadmes } from '../readme/refresh-readmes';

const check = process.argv.includes('--check');

const stale = await refreshReadmes({ check, rootDir: process.cwd() });

if (stale.length === 0) {
  console.log('README env tables are current.');
} else if (check) {
  console.error(`README env tables are stale — run \`bun run readme:sync\`:\n${stale.join('\n')}`);
  process.exit(1);
} else {
  console.log(`Refreshed README env tables:\n${stale.join('\n')}`);
}
