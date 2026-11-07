import { onTestFinished } from 'bun:test';
import type { Server, ServerWebSocket } from 'bun';
import { match } from 'ts-pattern';
import { z } from 'zod';

interface StubTarget {
  readonly id: string;
  readonly refusedMethods?: ReadonlyArray<string>;
  readonly type: string;
}

interface StubSession {
  readonly targetID: string;
  isOffline: boolean;
}

interface StubDevTools {
  readonly endpoint: string;
  readonly getFetchOutcome: (targetID: string) => 'failed' | 'ok';
  readonly isTargetPaused: (targetID: string) => boolean;
  readonly openTarget: (target: StubTarget) => void;
  readonly restartTarget: (targetID: string) => void;
}

const SOCKET_PATH_PREFIX = '/devtools/page/';

const ENABLE_METHODS = new Set(['Log.enable', 'Network.enable', 'Runtime.enable']);

const callSchema = z.object({
  id: z.number(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
});

// A DevTools endpoint that keeps network emulation per session, as Chrome does: the emulation a
// session sets lasts only while that session's socket stays open. A target that restarts while a
// session is attached starts paused, as Chrome starts a shared worker, until a session resumes it.
export function startStubDevTools(): StubDevTools {
  const targets = new Map<string, StubTarget>();
  const sockets = new Set<ServerWebSocket<StubSession>>();
  const pausedTargets = new Set<string>();

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

  const answerCall = (socket: ServerWebSocket<StubSession>, call: z.infer<typeof callSchema>) => {
    const refused = targets.get(socket.data.targetID)?.refusedMethods ?? [];

    const answer = match(call.method)
      .when(
        (method) => refused.includes(method),
        () => ({ error: { code: -32_000, message: `the target refused ${call.method}` } }),
      )
      .when(
        (method) => ENABLE_METHODS.has(method),
        () => ({ result: {} }),
      )
      .with('Network.emulateNetworkConditions', () => {
        socket.data.isOffline = call.params['offline'] === true;

        return { result: {} };
      })
      .with('Runtime.runIfWaitingForDebugger', () => {
        pausedTargets.delete(socket.data.targetID);

        return { result: {} };
      })
      .otherwise(() => ({ error: { code: -32_601, message: `'${call.method}' wasn't found` } }));

    socket.send(JSON.stringify({ id: call.id, ...answer }));
  };

  const server = Bun.serve<StubSession>({
    hostname: '127.0.0.1',
    port: 0,
    fetch: handleRequest,
    websocket: {
      open: (socket) => {
        sockets.add(socket);
      },
      message: (socket, message) => {
        const call = callSchema.parse(JSON.parse(String(message)));

        answerCall(socket, call);
      },
      close: (socket) => {
        sockets.delete(socket);
      },
    },
  });

  onTestFinished(async () => {
    await server.stop(true);
  });

  const collectTargetSockets = (targetID: string) =>
    [...sockets].filter((socket) => socket.data.targetID === targetID);

  return {
    endpoint: `${server.hostname}:${server.port}`,
    getFetchOutcome: (targetID) =>
      collectTargetSockets(targetID).some((socket) => socket.data.isOffline) ? 'failed' : 'ok',
    isTargetPaused: (targetID) => pausedTargets.has(targetID),
    openTarget: (target) => {
      targets.set(target.id, target);
    },
    restartTarget: (targetID) => {
      const attached = collectTargetSockets(targetID);

      if (attached.length > 0) {
        pausedTargets.add(targetID);
      }

      for (const socket of attached) {
        socket.send(JSON.stringify({ method: 'Inspector.targetCrashed', params: {} }));
        socket.send(JSON.stringify({ method: 'Inspector.targetReloadedAfterCrash', params: {} }));
      }
    },
  };
}
