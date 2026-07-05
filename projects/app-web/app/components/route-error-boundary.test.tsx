import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import type { ErrorResponse } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { RouteErrorBoundary } from './route-error-boundary';

interface TestConfig {
  error: Error | ErrorResponse;
}

function createMockRouteError(
  errorParts: Pick<ErrorResponse, 'status' | 'statusText'>,
): ErrorResponse {
  return {
    data: null,

    // @ts-expect-error - `internal` is not typed but it is required for react-router's
    // util to determine this as a route error
    internal: false,
    ...errorParts,
  };
}

function noop() {}

function setupTest(config: TestConfig) {
  vi.spyOn(console, 'error').mockImplementation(noop);

  const RouteStub = createRoutesStub([
    {
      Component: () => {
        throw config.error;
      },
      ErrorBoundary: RouteErrorBoundary,
      path: '/',
    },
  ]);

  return render(<RouteStub />);
}

afterEach(() => {
  vi.clearAllMocks();
});

test('it displays a not found message for 404 errors', async () => {
  setupTest({
    error: createMockRouteError({ status: 404, statusText: 'Not Found' }),
  });

  const errorMessage = await screen.findByText("We couldn't find what you were looking for");

  expect(errorMessage).toBeInTheDocument();
});

test('it displays a generic error message for non-route errors in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');

  setupTest({
    error: new Error('Test error'),
  });

  const errorMessage = await screen.findByText('Something went wrong');

  expect(errorMessage).toBeInTheDocument();
});

test('it displays the actual error message in development', async () => {
  vi.stubEnv('NODE_ENV', 'development');

  setupTest({
    error: new Error('Test error'),
  });

  const errorMessage = await screen.findByText('Test error');

  expect(errorMessage).toBeInTheDocument();
});

test('it provides a button to logout', async () => {
  setupTest({
    error: createMockRouteError({ status: 404, statusText: 'Not Found' }),
  });

  const logoutButton = await screen.findByRole('button', { name: /logout/i });

  expect(logoutButton).toBeInTheDocument();
});
