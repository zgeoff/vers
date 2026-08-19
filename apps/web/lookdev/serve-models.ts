/**
 * Dev-only static server for the lookdev model assets. The page's hot-reload watcher polls it
 * for Last-Modified changes and re-loads the glTF when Blender re-exports. Run alongside the
 * bundle server: `bun ./serve-models.ts` (port 4601).
 */
const modelsDir = new URL('./models/', import.meta.url).pathname;

Bun.serve({
  port: 4601,
  async fetch(request) {
    const name = new URL(request.url).pathname.replace(/^\//, '');

    if (!/^[\w.-]+$/.test(name)) {
      return new Response('bad name', { status: 400 });
    }

    const file = Bun.file(modelsDir + name);

    if (!(await file.exists())) {
      return new Response('missing', { status: 404 });
    }

    return new Response(file, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'Last-Modified': new Date(file.lastModified).toUTCString(),
      },
    });
  },
});

console.log(`serving ${modelsDir} on :4601`);
