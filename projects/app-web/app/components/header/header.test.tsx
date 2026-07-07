import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { expect, test } from 'vitest';
import { useNavigationVisible } from '../../state/use-navigation-visible';
import { Header } from './header';

function setupTest() {
  const user = userEvent.setup();

  const HeaderStub = createRoutesStub([
    {
      Component: () => {
        const isNavVisble = useNavigationVisible();

        return (
          <>
            <Header />
            <p>{isNavVisble ? 'open' : 'closed'}</p>
          </>
        );
      },
      path: '/',
    },
  ]);

  render(<HeaderStub />);

  return { user };
}

test('it renders a button that toggles the side navigation', async () => {
  const setup = setupTest();

  expect(screen.getByText('closed')).toBeInTheDocument();

  await setup.user.click(screen.getByRole('button', { name: /toggle navigation/i }));

  expect(screen.getByText('open')).toBeInTheDocument();
});
