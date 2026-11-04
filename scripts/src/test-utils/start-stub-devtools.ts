import { onTestFinished } from 'bun:test';
import type { Server, ServerWebSocket } from 'bun';
import { z } from 'zod';

interface StubTarget {
  readonly id: string;
  readonly type: string;
}

interface StubSession {
  readonly targetID: string;
  isOffline: boolean;
}

interface StubDevTools {
  readonly endpoint: string;
  readonly getFetchOutcome: (targetID: string) => 'failed' | 'ok';
  readonly openTarget: (target: StubTarget) => void;
}

const SOCKET_PATH_PREFIX = '/devtools/page/';

const callSchema = z.object({
  id: z.number(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

// A DevTools endpoint that keeps network emulation per session, as Chrome does: the emulation a
// session sets lasts only while that session's socket stays open.
export function startStubDevTools(): StubDevTools {
  const targets = new Map<string, StubTarget>();
  const sessions = new Set<StubSession>();

  const handleRequest = (request: Request, bunServer: Server<StubSession>) => {
    const path = new URL(request.url).pathname;

    if (path === '/json' || path === '/json/list') {
      const listed = [...targets.values()].map((target) => ({
        id: target.id,
        title: '',
        type: target.type,
        url: 'https://example.test/',
        webSocketDebuggerUrl: `ws://${bunServer.hostname}:${bunServer.port}${SOCKET_PATH_PREFIX}${target.id}`,
      }));

      return Response.json(listed);
    }

    const targetID = path.slice(SOCKET_PATH_PREFIX.length);

    const isUpgraded =
      path.startsWith(SOCKET_PATH_PREFIX) &&
      targets.has(targetID) &&
      bunServer.upgrade(request, { data: { isOffline: false, targetID } });

    return isUpgraded ? undefined : new Response('not found', { status: 404 });
  };

  const server = Bun.serve<StubSession>({
    hostname: '127.0.0.1',
    port: 0,
    fetch: handleRequest,
    websocket: {
      open: (socket) => {
        sessions.add(socket.data);
      },
      message: (socket, message) => {
        const call = callSchema.parse(JSON.parse(String(message)));

        answerCall(socket, call);
      },
      close: (socket) => {
        sessions.delete(socket.data);
      },
    },
  });

  onTestFinished(async () => {
    await server.stop(true);
  });

  return {
    endpoint: `${server.hostname}:${server.port}`,
    getFetchOutcome: (targetID) =>
      [...sessions].some((session) => session.targetID === targetID && session.isOffline)
        ? 'failed'
        : 'ok',
    openTarget: (target) => {
      targets.set(target.id, target);
    },
  };
}

function answerCall(socket: ServerWebSocket<StubSession>, call: z.infer<typeof callSchema>) {
  if (call.method === 'Network.enable') {
    socket.send(JSON.stringify({ id: call.id, result: {} }));

    return;
  }

  if (call.method === 'Network.emulateNetworkConditions') {
    socket.data.isOffline = call.params['offline'] === true;

    socket.send(JSON.stringify({ id: call.id, result: {} }));

    return;
  }

  socket.send(
    JSON.stringify({
      error: { code: -32_601, message: `'${call.method}' wasn't found` },
      id: call.id,
    }),
  );
}
