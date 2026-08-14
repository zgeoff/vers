import { expect, test } from 'bun:test';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Viewport } from '@vers/worldmap-core';
import { StrictMode, createElement } from 'react';
import type { ReactNode } from 'react';
import { useChunkStream } from './use-chunk-stream';

interface StubEntry {
  readonly chunkX: number;
  readonly chunkY: number;
}

interface ViewportProps {
  readonly viewport: Viewport;
}

interface WrapperProps {
  readonly children: ReactNode;
}

const ONE_CHUNK_VIEWPORT: Viewport = { maxCX: 15, maxCY: 15, minCX: 0, minCY: 0 };
const TWO_CHUNK_VIEWPORT: Viewport = { maxCX: 31, maxCY: 15, minCX: 0, minCY: 0 };

test('it returns no entries while the seed or the viewport is missing', () => {
  const hook = renderHook(() =>
    useChunkStream<StubEntry>({
      build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
      cacheCapacity: 8,
      dispose: () => {},
      userSeed: null,
      viewport: ONE_CHUNK_VIEWPORT,
    }),
  );

  expect(hook.result.current).toHaveLength(0);
});

test('it fills a miss over following animation frames rather than on the first render', async () => {
  const hook = renderHook(() =>
    useChunkStream<StubEntry>({
      build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
      cacheCapacity: 8,
      dispose: () => {},
      userSeed: 1,
      viewport: ONE_CHUNK_VIEWPORT,
    }),
  );

  expect(hook.result.current).toHaveLength(0);

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
  });
});

test('it fills a two-chunk miss set across two separate animation-frame ticks, never both in one', async () => {
  const ticks: Array<number> = [];

  const hook = renderHook(() =>
    useChunkStream<StubEntry>({
      build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
      cacheCapacity: 8,
      dispose: () => {},
      onBuildTick: (_buildMs, builtChunkCount) => {
        ticks.push(builtChunkCount);
      },
      userSeed: 1,
      viewport: TWO_CHUNK_VIEWPORT,
    }),
  );

  await waitFor(() => {
    expect(hook.result.current).toIncludeSameMembers([
      { chunkX: 0, chunkY: 0 },
      { chunkX: 1, chunkY: 0 },
    ]);
  });

  expect(ticks).toStrictEqual([1, 1]);
});

test('it resolves an already-built chunk instantly on a later render, with no further build', async () => {
  const disposed: Array<StubEntry> = [];

  const hook = renderHook(
    (viewport: Viewport) =>
      useChunkStream<StubEntry>({
        build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
        cacheCapacity: 8,
        dispose: (entry) => {
          disposed.push(entry);
        },
        userSeed: 1,
        viewport,
      }),
    { initialProps: ONE_CHUNK_VIEWPORT },
  );

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
  });

  const otherViewport: Viewport = { maxCX: 47, maxCY: 15, minCX: 32, minCY: 0 };

  act(() => {
    hook.rerender(otherViewport);
  });

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual([{ chunkX: 2, chunkY: 0 }]);
  });

  act(() => {
    hook.rerender(ONE_CHUNK_VIEWPORT);
  });

  expect(hook.result.current).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
  expect(disposed).toHaveLength(0);
});

test('it disposes every cached entry the moment the seed changes', async () => {
  const disposed: Array<StubEntry> = [];

  const hook = renderHook(
    (userSeed: number) =>
      useChunkStream<StubEntry>({
        build: (_seed, chunkX, chunkY) => ({ chunkX, chunkY }),
        cacheCapacity: 8,
        dispose: (entry) => {
          disposed.push(entry);
        },
        userSeed,
        viewport: ONE_CHUNK_VIEWPORT,
      }),
    { initialProps: 1 },
  );

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
  });

  act(() => {
    hook.rerender(2);
  });

  expect(hook.result.current).toHaveLength(0);
  expect(disposed).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
});

test('it disposes every cached entry on unmount', async () => {
  const disposed: Array<StubEntry> = [];

  const hook = renderHook(() =>
    useChunkStream<StubEntry>({
      build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
      cacheCapacity: 8,
      dispose: (entry) => {
        disposed.push(entry);
      },
      userSeed: 1,
      viewport: ONE_CHUNK_VIEWPORT,
    }),
  );

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
  });

  act(() => {
    hook.unmount();
  });

  expect(disposed).toStrictEqual([{ chunkX: 0, chunkY: 0 }]);
});

test('it reports each build tick to onBuildTick with the chunk count it built', async () => {
  const ticks: Array<{ builtChunkCount: number }> = [];

  renderHook(() =>
    useChunkStream<StubEntry>({
      build: (_userSeed, chunkX, chunkY) => ({ chunkX, chunkY }),
      cacheCapacity: 8,
      dispose: () => {},
      onBuildTick: (_buildMs, builtChunkCount) => {
        ticks.push({ builtChunkCount });
      },
      userSeed: 1,
      viewport: ONE_CHUNK_VIEWPORT,
    }),
  );

  await waitFor(() => {
    expect(ticks).toStrictEqual([{ builtChunkCount: 1 }]);
  });
});

test('it still prefetches the leading-edge chunk under development double-rendering', async () => {
  const built: Array<string> = [];

  const hook = renderHook(
    (props: ViewportProps) =>
      useChunkStream<StubEntry>({
        build: (_userSeed, chunkX, chunkY) => {
          built.push(`${chunkX}_${chunkY}`);

          return { chunkX, chunkY };
        },
        cacheCapacity: 32,
        dispose: () => {},
        userSeed: 1,
        viewport: props.viewport,
      }),
    {
      initialProps: { viewport: ONE_CHUNK_VIEWPORT },
      wrapper: (props: WrapperProps) => createElement(StrictMode, null, props.children),
    },
  );

  await waitFor(() => {
    expect(built).toContain('0_0');
  });

  // pan one chunk east: the entered chunk 1_0 streams in, and the prefetch strip one beyond the
  // leading edge queues chunk 2_0 — a movement the write-in-render version silently missed here,
  // because StrictMode's second render read the range the first render already advanced
  await act(() => {
    hook.rerender({ viewport: { maxCX: 31, maxCY: 15, minCX: 16, minCY: 0 } });

    return Promise.resolve();
  });

  await waitFor(() => {
    expect(built).toContain('2_0');
  });
});
