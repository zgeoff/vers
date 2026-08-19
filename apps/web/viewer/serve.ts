/**
 * Dev side server for the viewer: serves the shared Blender export directory (the lookdev
 * models/ folder the Blender auto-export already targets), lists it as /index.json for the
 * model watcher, and persists the viewer's data files (placements, knob values) via POST so
 * the plan editor and tuner save straight to disk. Run: `bun ./serve.ts` (port 4601).
 */
const modelsDir = new URL('../lookdev/models/', import.meta.url).pathname;
const dataDir = new URL('./data/', import.meta.url).pathname;

const DATA_FILES = new Set(['placements.json', 'knobs.json']);

const CORS = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

Bun.serve({
  port: 4601,
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS, status: 204 });
    }

    const path = new URL(request.url).pathname;

    // data files: GET reads, POST overwrites — the no-copy-paste persistence loop
    if (path.startsWith('/data/')) {
      const name = path.slice('/data/'.length);

      if (!DATA_FILES.has(name)) {
        return new Response('unknown data file', { headers: CORS, status: 404 });
      }

      const file = Bun.file(dataDir + name);

      if (request.method === 'POST') {
        const body = await request.json();

        await Bun.write(file, `${JSON.stringify(body, null, 2)}\n`);

        return Response.json({ ok: true }, { headers: CORS });
      }

      if (!(await file.exists())) {
        return new Response('missing', { headers: CORS, status: 404 });
      }

      return new Response(file, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    const name = path.replace(/^\//, '');

    if (!/^[\w.-]+$/.test(name)) {
      return new Response('bad name', { headers: CORS, status: 400 });
    }

    // the model watcher polls this listing to hot-load every .glb in the directory
    if (name === 'index.json') {
      const entries: Array<{ mtime: number; name: string }> = [];

      for await (const file of new Bun.Glob('*.glb').scan(modelsDir)) {
        entries.push({ mtime: Bun.file(modelsDir + file).lastModified, name: file });
      }

      return Response.json(entries, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
    }

    const file = Bun.file(modelsDir + name);

    if (!(await file.exists())) {
      return new Response('missing', { headers: CORS, status: 404 });
    }

    return new Response(file, {
      headers: {
        ...CORS,
        'Cache-Control': 'no-store',
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  },
});

console.log(`serving models from ${modelsDir} and data from ${dataDir} on :4601`);
