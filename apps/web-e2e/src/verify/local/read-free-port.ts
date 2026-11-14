// The kernel picks a free port for a listener on port 0; the port stays free once it closes, so a
// child that binds it next gets it, unless another process takes it first.
export function readFreePort(): number {
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data: () => {} },
  });

  const port = listener.port;

  listener.stop(true);

  return port;
}
