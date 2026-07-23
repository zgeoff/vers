import { expect, mock, test } from 'bun:test';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { StandardLazyResponse } from '@orpc/standard-server';
import { buildRetryInterceptor } from './build-retry-interceptor';

function buildOptions(
  next: () => Promise<StandardLazyResponse>,
  signal?: AbortSignal,
): StandardLinkClientInterceptorOptions<Record<never, never>> & { next: typeof next } {
  return {
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal,
      url: new URL('http://test.local/rpc'),
    },
  };
}

function buildResponse(status: number): StandardLazyResponse {
  return { body: () => Promise.resolve(undefined), headers: {}, status };
}

test('it retries a 5xx response and returns the following success', async () => {
  let callCount = 0;

  const next = mock((): Promise<StandardLazyResponse> => {
    callCount += 1;

    const response = callCount === 1 ? buildResponse(503) : buildResponse(200);

    return Promise.resolve(response);
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(200);
  expect(next).toHaveBeenCalledTimes(2);
});

test('it retries a thrown transport error and returns the following success', async () => {
  let callCount = 0;

  const next = mock((): Promise<StandardLazyResponse> => {
    callCount += 1;

    if (callCount === 1) {
      throw new Error('transport down');
    }

    return Promise.resolve(buildResponse(200));
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(200);
  expect(next).toHaveBeenCalledTimes(2);
});

test('it does not retry a 4xx response', async () => {
  const next = mock((): Promise<StandardLazyResponse> => Promise.resolve(buildResponse(404)));
  const interceptor = buildRetryInterceptor({ isRetryable: () => true });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(404);
  expect(next).toHaveBeenCalledOnce();
});

test('it does not retry a 5xx response for a non-retryable path', async () => {
  const next = mock((): Promise<StandardLazyResponse> => Promise.resolve(buildResponse(503)));
  const interceptor = buildRetryInterceptor({ isRetryable: () => false });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(503);
  expect(next).toHaveBeenCalledOnce();
});

test('it exhausts its retry budget and returns the last 5xx response', async () => {
  const next = mock((): Promise<StandardLazyResponse> => Promise.resolve(buildResponse(503)));

  const interceptor = buildRetryInterceptor({
    backoffMs: 1,
    isRetryable: () => true,
    maxRetries: 2,
  });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(503);
  expect(next).toHaveBeenCalledTimes(3);
});

test('it exhausts its retry budget and rethrows the last transport error', async () => {
  const next = mock((): Promise<StandardLazyResponse> => {
    throw new Error('transport down');
  });

  const interceptor = buildRetryInterceptor({
    backoffMs: 1,
    isRetryable: () => true,
    maxRetries: 2,
  });

  const pending = interceptor(buildOptions(next));

  expect(pending).rejects.toThrowWithMessage(Error, 'transport down');

  await expect(pending).toReject();

  expect(next).toHaveBeenCalledTimes(3);
});

test('it rethrows immediately without retrying once the caller has aborted', async () => {
  const controller = new AbortController();

  controller.abort();

  const next = mock((): Promise<StandardLazyResponse> => {
    throw new Error('transport down');
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true });
  const pending = interceptor(buildOptions(next, controller.signal));

  expect(pending).rejects.toThrowWithMessage(Error, 'transport down');

  await expect(pending).toReject();

  expect(next).toHaveBeenCalledOnce();
});

test('it invokes onRetry once per retry', async () => {
  let callCount = 0;

  const next = mock((): Promise<StandardLazyResponse> => {
    callCount += 1;

    const response = callCount <= 2 ? buildResponse(503) : buildResponse(200);

    return Promise.resolve(response);
  });

  const onRetry = mock<() => void>(() => {});
  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true, onRetry });

  const response = await interceptor(buildOptions(next));

  expect(response.status).toBe(200);
  expect(onRetry).toHaveBeenCalledTimes(2);
});
