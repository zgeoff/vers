import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// holds its stop on SIGTERM, as the web server does while a browser keeps a connection open

process.on('SIGTERM', () => {
  process.stderr.write('stub held server: holding its stop\n');
});

await writeFile(join(process.env['STUB_PID_DIRECTORY'] ?? '/tmp', String(process.pid)), '');

Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env['STUB_PORT']),
  routes: { '/health': new Response('ok') },
});
