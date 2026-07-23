import { expect, mock, test } from 'bun:test';
import type { StandardLazyResponse } from '@orpc/standard-server';
import { buildRetryInterceptor } from './build-retry-interceptor';

test('it retries a 5xx response and returns the following success', async () => {
  let callCount = 0;

  const next = mock((): Promise<StandardLazyResponse> => {
    callCount += 1;

    return Promise.resolve({
      body: () => Promise.resolve(undefined),
      headers: {},
      status: callCount === 1 ? 503 : 200,
    });
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

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

    return Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 200 });
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

  expect(response.status).toBe(200);
  expect(next).toHaveBeenCalledTimes(2);
});

test('it does not retry a 4xx response', async () => {
  const next = mock(
    (): Promise<StandardLazyResponse> =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 404 }),
  );

  const interceptor = buildRetryInterceptor({ isRetryable: () => true });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

  expect(response.status).toBe(404);
  expect(next).toHaveBeenCalledOnce();
});

test('it does not retry a 5xx response for a non-retryable path', async () => {
  const next = mock(
    (): Promise<StandardLazyResponse> =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 503 }),
  );

  const interceptor = buildRetryInterceptor({ isRetryable: () => false });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

  expect(response.status).toBe(503);
  expect(next).toHaveBeenCalledOnce();
});

test('it exhausts its retry budget and returns the last 5xx response', async () => {
  const next = mock(
    (): Promise<StandardLazyResponse> =>
      Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 503 }),
  );

  const interceptor = buildRetryInterceptor({
    backoffMs: 1,
    isRetryable: () => true,
    maxRetries: 2,
  });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

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

  const pending = interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

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

  const pending = interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: controller.signal,
      url: new URL('http://test.local/rpc'),
    },
  });

  expect(pending).rejects.toThrowWithMessage(Error, 'transport down');

  await expect(pending).toReject();

  expect(next).toHaveBeenCalledOnce();
});

test('it stops retrying when the caller aborts during the backoff wait', async () => {
  const controller = new AbortController();

  const next = mock((): Promise<StandardLazyResponse> => {
    // abort while the post-attempt backoff timer is armed, exercising the pending-wait abort path
    setTimeout(() => {
      controller.abort();
    }, 0);

    return Promise.resolve({ body: () => Promise.resolve(undefined), headers: {}, status: 503 });
  });

  const interceptor = buildRetryInterceptor({ backoffMs: 100, isRetryable: () => true });

  const pending = interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: controller.signal,
      url: new URL('http://test.local/rpc'),
    },
  });

  await expect(pending).toReject();

  expect(next).toHaveBeenCalledOnce();
});

test('it invokes onRetry once per retry', async () => {
  let callCount = 0;

  const next = mock((): Promise<StandardLazyResponse> => {
    callCount += 1;

    return Promise.resolve({
      body: () => Promise.resolve(undefined),
      headers: {},
      status: callCount <= 2 ? 503 : 200,
    });
  });

  const onRetry = mock<() => void>(() => {});
  const interceptor = buildRetryInterceptor({ backoffMs: 1, isRetryable: () => true, onRetry });

  const response = await interceptor({
    context: {},
    input: undefined,
    next,
    path: ['activity', 'getLatestActivityProgress'],
    request: {
      body: undefined,
      headers: {},
      method: 'GET',
      signal: undefined,
      url: new URL('http://test.local/rpc'),
    },
  });

  expect(response.status).toBe(200);
  expect(onRetry).toHaveBeenCalledTimes(2);
});
