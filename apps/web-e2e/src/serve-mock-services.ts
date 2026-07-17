import { RPCHandler } from '@orpc/server/fetch';
import type { MockContext } from '@vers/mock-services';
import { createDemoSeed, resolveServiceURL, resolveSessionContext } from '@vers/mock-services';
import { activityRouter } from '@vers/mock-services/activity';
import { avatarRouter } from '@vers/mock-services/avatar';
import { emailRouter } from '@vers/mock-services/email';
import { keysRouter } from '@vers/mock-services/keys';
import { replayRouter } from '@vers/mock-services/replay';
import { sessionRouter } from '@vers/mock-services/session';
import { userRouter } from '@vers/mock-services/user';
import { verificationRouter } from '@vers/mock-services/verification';
import type { ServiceName } from '@vers/service-auth';

/**
 * Serves the stateful mock backends over real HTTP, one listener per service on the same origins
 * the production server's `SERVICE_URLS` defaults resolve, so `server.mjs` needs no env
 * repointing. The vite-dev mock plugin hosts these same routers in-process; this entrypoint
 * exists for runs against the built artifact, which can host no mock backend. Requests
 * round-trip oRPC's real wire protocol; a procedure a router doesn't implement 404s.
 */
const RPC_HANDLERS: Readonly<Record<ServiceName, RPCHandler<MockContext>>> = {
  activity: new RPCHandler(activityRouter),
  avatar: new RPCHandler(avatarRouter),
  email: new RPCHandler(emailRouter),
  keys: new RPCHandler(keysRouter),
  replay: new RPCHandler(replayRouter),
  session: new RPCHandler(sessionRouter),
  user: new RPCHandler(userRouter),
  verification: new RPCHandler(verificationRouter),
};

await createDemoSeed();

const SERVICES = [
  'activity',
  'avatar',
  'email',
  'keys',
  'replay',
  'session',
  'user',
  'verification',
] as const satisfies ReadonlyArray<ServiceName>;

for (const service of SERVICES) {
  const rpcHandler = RPC_HANDLERS[service];

  const url = new URL(resolveServiceURL(service));

  Bun.serve({
    fetch: async (request) => {
      if (new URL(request.url).pathname === '/health') {
        return Response.json({ ok: true });
      }

      const handled = await rpcHandler.handle(request, {
        context: resolveSessionContext(request),
        prefix: '/rpc',
      });

      return handled.matched ? handled.response : new Response(null, { status: 404 });
    },

    // never the wildcard interface: these routers accept unverified bearer subjects and expose
    // mutating procedures, so nothing beyond this host may reach them
    hostname: url.hostname,
    port: Number(url.port),
  });

  console.log(`mock ${service} listening on ${url.origin}`);
}
