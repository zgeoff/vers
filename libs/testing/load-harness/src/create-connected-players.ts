import { buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import { createLoadSession } from './create-load-session';
import { createOriginChain } from './create-origin-chain';
import { createPlayerClient } from './create-player-client';
import type { CallLog, ConnectedPlayer, LoadPlayerAccount, LoadStack } from './types';

const SIGN_IN_CONCURRENCY = 20;

// signs every player in and reveals its origin before the measured window opens, so the window
// holds only the play traffic
export async function createConnectedPlayers(
  stack: Readonly<LoadStack>,
  accounts: ReadonlyArray<LoadPlayerAccount>,
  callLog: CallLog,
): Promise<Array<ConnectedPlayer>> {
  const connected: Array<ConnectedPlayer> = [];

  for (let first = 0; first < accounts.length; first += SIGN_IN_CONCURRENCY) {
    const group = accounts.slice(first, first + SIGN_IN_CONCURRENCY);

    connected.push(
      ...(await Promise.all(group.map((account) => connectPlayer(stack, account, callLog)))),
    );
  }

  return connected;
}

async function connectPlayer(
  stack: Readonly<LoadStack>,
  account: LoadPlayerAccount,
  callLog: CallLog,
): Promise<ConnectedPlayer> {
  const jar = await createLoadSession(
    {
      privateKey: stack.privateKey,
      sessionSecret: stack.sessionSecret,
      sessionServiceURL: stack.sessionServiceURL,
    },
    account.userID,
  );

  const client = createPlayerClient({
    appURL: stack.appURL,
    jar,
    onCall: (record) => {
      callLog.calls.push(record);
    },
  });

  const chain = await createOriginChain(client, account.avatarID);
  const document = await client.getContentDocument({ contentVersion: chain.contentVersion });

  const xp = buildXPThreshold(account.profile.level);

  return {
    account,
    buildSnapshot: { level: buildLevelFromXP(xp), xp },
    chain,
    client,
    content: document.encounter,
  };
}
