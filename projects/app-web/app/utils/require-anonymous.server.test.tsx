import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '~/mocks/db';
import { withAuthedUser } from '~/test-utils/with-authed-user';
import { Routes } from '~/types';
import { requireAnonymous } from './require-anonymous.server';

interface TestConfig {
  isAuthed?: boolean;
}

interface LoaderArgs {
  request: Request;
}

async function loader(args: LoaderArgs) {
  await requireAnonymous(args.request);

  return null;
}

function setupTest(config: TestConfig = {}) {
  const TestRoutesStub = createRoutesStub([
    {
      Component: () => 'TEST_ROUTE',
      ...(config.isAuthed && { loader: withAuthedUser(loader) }),
      path: '/',
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
  ]);

  render(<TestRoutesStub />);
}

afterEach(() => {
  drop(db);
});

test('it allows access when no session exists', async () => {
  setupTest();

  const testRoute = await screen.findByText('TEST_ROUTE');

  expect(testRoute).toBeInTheDocument();
});

test('it redirects to the nexus when a session exists', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});
