const port = Number(process.env['UMAMI_STUB_PORT'] ?? 3021);

// A stand-in for the umami deployment that app-web's analytics proxy forwards to: the stack image
// bakes the tracker tag in, so a page that loads it needs `/script.js` to answer real JavaScript.
// The tracker script is a no-op, and `POST /api/send` accepts and drops a beacon.
function handleRequest(request: Request): Response {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return Response.json({ ok: true });
  }

  if (url.pathname === '/script.js' && request.method === 'GET') {
    return new Response('', { headers: { 'content-type': 'application/javascript' } });
  }

  if (url.pathname === '/api/send' && request.method === 'POST') {
    return Response.json({ ok: true });
  }

  return new Response(null, { status: 404 });
}

Bun.serve({
  fetch: handleRequest,
  hostname: '0.0.0.0',
  port,
});

console.log(`umami stub listening on http://localhost:${port}`);
