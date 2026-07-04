import { isDefinedError } from '@orpc/client';
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { orpc } from '../orpc';
import { readCurrentUser } from '../read-current-user';

const serverFnUserQueryOptions = queryOptions({
  queryKey: ['current-user', 'via-server-fn'],
  queryFn: () => readCurrentUser(),
});

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await Promise.all([
      // Direct-RPC prefetch: signed out, this rejects with the typed UNAUTHORIZED error; the
      // panel renders the error state instead of failing the route, so swallow it here.
      context.queryClient
        .ensureQueryData(orpc.getCurrentUser.queryOptions())
        .catch(() => undefined),
      context.queryClient.ensureQueryData(serverFnUserQueryOptions),
    ]);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <main
      style={{
        fontFamily: 'system-ui',
        maxWidth: '40rem',
        margin: '2rem auto',
      }}
    >
      <h1>spike 157 — oRPC / Elysia / TanStack Start</h1>
      <SessionControls />
      <DirectRPCPanel />
      <ServerFnPanel />
    </main>
  );
}

function SessionControls() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function refreshSession(token: string | null) {
    updateSessionCookie(token);
    await queryClient.invalidateQueries();
    await router.invalidate();
  }

  return (
    <p>
      <button onClick={() => refreshSession('dev-session-token')}>
        Sign in
      </button>{' '}
      <button onClick={() => refreshSession('expired-session-token')}>
        Use expired session
      </button>{' '}
      <button onClick={() => refreshSession(null)}>Sign out</button>
    </p>
  );
}

/**
 * Consumption path 1: the contract-typed client called through TanStack Query, prefetched in
 * the loader and SSR-hydrated. The typed UNAUTHORIZED error surfaces on `query.error` with its
 * `data.reason` payload intact.
 */
function DirectRPCPanel() {
  const query = useQuery(orpc.getCurrentUser.queryOptions({ retry: false }));

  return (
    <section>
      <h2>Direct RPC via Query hydration</h2>
      {query.isPending && <p>Loading…</p>}
      {query.data && (
        <p>
          Signed in as <strong>{query.data.displayName}</strong> (
          {query.data.email})
        </p>
      )}
      {query.error &&
        (isDefinedError(query.error) ? (
          <p>
            Not signed in — typed reason: <code>{query.error.data.reason}</code>
          </p>
        ) : (
          <p>Untyped error: {query.error.message}</p>
        ))}
    </section>
  );
}

/**
 * Consumption path 2: a Start server function wraps the client and returns a plain result
 * union, so the error case is ordinary data by the time it crosses to the browser.
 */
function ServerFnPanel() {
  const query = useSuspenseQuery(serverFnUserQueryOptions);

  return (
    <section>
      <h2>Server function via Query hydration</h2>
      {query.data.authenticated ? (
        <p>
          Signed in as <strong>{query.data.user.displayName}</strong> (
          {query.data.user.email})
        </p>
      ) : (
        <p>
          Not signed in — typed reason: <code>{query.data.reason}</code>
        </p>
      )}
    </section>
  );
}

function updateSessionCookie(token: string | null) {
  document.cookie =
    token === null
      ? 'session=; path=/; max-age=0'
      : `session=${token}; path=/; max-age=86400; samesite=lax`;
}
