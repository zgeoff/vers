import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import { createServiceToken } from '@vers/service-auth';
import { sealData } from 'iron-session';
import type { CryptoKey } from 'jose';
import type { CookieJar } from './types';

interface CreateLoadSessionDeps {
  readonly privateKey: CryptoKey;
  readonly sessionSecret: string;
  readonly sessionServiceURL: string;
}

const SESSION_COOKIE_NAME = 'en_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24;

// signs a player in the way app-web's sign-in does: a verified session row, its token pair, and
// the sealed cookie app-web reads back on every proxied call
export async function createLoadSession(
  deps: Readonly<CreateLoadSessionDeps>,
  userID: string,
): Promise<CookieJar> {
  const client: ContractRouterClient<typeof sessionContract, { actingUserID?: string }> =
    createORPCClient(
      new RPCLink<{ actingUserID?: string }>({
        headers: async (options) => ({
          authorization: `Bearer ${await createServiceToken({
            audience: 'session',
            issuer: 'app-web',
            privateKey: deps.privateKey,
            ...(options.context.actingUserID !== undefined && {
              actingUserID: options.context.actingUserID,
            }),
          })}`,
        }),
        url: `${deps.sessionServiceURL}/rpc`,
      }),
    );

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await client.createSession({ expiresAt, ipAddress: '127.0.0.1', userID });

  const tokens = await client.verifySession(
    { id: session.id },
    { context: { actingUserID: userID } },
  );

  const sealed = await sealData(
    {
      accessToken: tokens.accessToken,
      expires: expiresAt.toISOString(),
      refreshToken: tokens.refreshToken,
      sessionID: session.id,
      userID,
    },
    { password: deps.sessionSecret, ttl: SESSION_TTL_SECONDS },
  );

  return { header: `${SESSION_COOKIE_NAME}=${sealed}`, name: SESSION_COOKIE_NAME };
}
