import { expect, onTestFinished, test } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { RSC_QUERY_KEY_PREFIX } from './rsc-query-key-prefix';
import {
  QUERY_BROADCAST_CHANNEL_NAME,
  subscribeToQueryBroadcast,
} from './subscribe-to-query-broadcast';

function setupTest() {
  const sender = new QueryClient();
  const peer = new QueryClient();

  const detachSender = subscribeToQueryBroadcast(sender);
  const detachPeer = subscribeToQueryBroadcast(peer);

  onTestFinished(() => {
    detachSender();
    detachPeer();
  });

  return { detachSender, peer, sender };
}

test('it applies a resolved query onto a peer tab', async () => {
  const ctx = setupTest();

  ctx.sender.setQueryData(['avatar', 'active'], { name: 'vers' });

  await waitFor(() => {
    expect(ctx.peer.getQueryData<{ name: string }>(['avatar', 'active'])).toStrictEqual({
      name: 'vers',
    });
  });
});

test('it leaves an RSC-keyed query out of the broadcast', async () => {
  const ctx = setupTest();

  ctx.sender.setQueryData([RSC_QUERY_KEY_PREFIX, 'node-codex', 1], { src: 'fragment' });
  ctx.sender.setQueryData(['avatar', 'progression'], { level: 3 });

  await waitFor(() => {
    expect(ctx.peer.getQueryData<{ level: number }>(['avatar', 'progression'])).toStrictEqual({
      level: 3,
    });
  });

  expect(
    ctx.peer.getQueryData<{ src: string }>([RSC_QUERY_KEY_PREFIX, 'node-codex', 1]),
  ).toBeUndefined();
});

test('it keeps a payload structured clone rejects inside the sending tab', () => {
  const ctx = setupTest();

  expect(() => {
    ctx.sender.setQueryData(['proxied'], { src: new Proxy({ node: 1 }, {}) });
  }).not.toThrow();
});

test('it removes an observed query from a peer tab', async () => {
  const ctx = setupTest();

  ctx.sender.setQueryData(['seed', 'cached'], 'seed-1');

  const observer = new QueryObserver(ctx.sender, { enabled: false, queryKey: ['seed', 'cached'] });

  const unsubscribeObserver = observer.subscribe(() => {});

  onTestFinished(() => {
    unsubscribeObserver();
  });

  await waitFor(() => {
    expect(ctx.peer.getQueryData<string>(['seed', 'cached'])).toBe('seed-1');
  });

  ctx.sender.removeQueries({ queryKey: ['seed', 'cached'] });

  await waitFor(() => {
    expect(ctx.peer.getQueryData<string>(['seed', 'cached'])).toBeUndefined();
  });
});

test('it stops broadcasting once the returned detach runs', async () => {
  const ctx = setupTest();

  ctx.detachSender();
  ctx.sender.setQueryData(['detached'], 'after-detach');
  ctx.peer.setQueryData(['peer-writes'], 'own-write');

  await waitFor(() => {
    expect(ctx.peer.getQueryData<string>(['peer-writes'])).toBe('own-write');
  });

  expect(ctx.peer.getQueryData<string>(['detached'])).toBeUndefined();
});

test('it ignores an update a peer sent without its key or state', async () => {
  const ctx = setupTest();

  const peerChannel = new BroadcastChannel(QUERY_BROADCAST_CHANNEL_NAME);

  onTestFinished(() => {
    peerChannel.close();
  });

  peerChannel.postMessage({ queryHash: '["malformed"]', type: 'updated' });
  ctx.sender.setQueryData(['well-formed'], 'landed');

  await waitFor(() => {
    expect(ctx.peer.getQueryData<string>(['well-formed'])).toBe('landed');
  });

  expect(ctx.peer.getQueryCache().get('["malformed"]')).toBeUndefined();
});

test('it keeps a resolve this tab made after the one a peer sends', async () => {
  const ctx = setupTest();

  ctx.peer.setQueryData(['race'], 'local-later', { updatedAt: 2000 });
  ctx.sender.setQueryData(['race'], 'peer-earlier', { updatedAt: 1000 });
  ctx.sender.setQueryData(['race-barrier'], 'sent-after');

  await waitFor(() => {
    expect(ctx.peer.getQueryData<string>(['race-barrier'])).toBe('sent-after');
  });

  expect(ctx.peer.getQueryData<string>(['race'])).toBe('local-later');
});

test('it opens no channel where there is no window to mirror onto', () => {
  const originalWindow = globalThis.window;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  let constructed = 0;

  globalThis.BroadcastChannel = class extends originalBroadcastChannel {
    constructor(name: string) {
      super(name);

      constructed += 1;
    }
  };

  Reflect.deleteProperty(globalThis, 'window');

  onTestFinished(() => {
    globalThis.window = originalWindow;
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  const detach = subscribeToQueryBroadcast(new QueryClient());

  detach();

  expect(constructed).toBe(0);
});

test('it opens no channel where BroadcastChannel is absent', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  Reflect.deleteProperty(globalThis, 'BroadcastChannel');

  onTestFinished(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  const detach = subscribeToQueryBroadcast(new QueryClient());

  expect(detach).not.toThrow();
});
