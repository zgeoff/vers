import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Brand, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { orpc } from '../lib/rpc/orpc';

const layout = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  justifyContent: 'center',
  minHeight: '[100vh]',
  paddingX: '6',
  textAlign: 'center',
});

const linkRow = css({ display: 'flex', gap: '4', justifyContent: 'center' });

export function NotFoundScreen() {
  // the root route runs no loader, so the only session evidence it holds is the avatar list a game
  // screen cached earlier in this browser session; a direct load of an unknown URL carries none,
  // and fetching here would spend a request on every stray URL a signed-out visitor types
  const avatarsQuery = useQuery({
    ...orpc.avatar.getAvatars.queryOptions({ input: {} }),
    enabled: false,
  });

  return (
    <main className={layout}>
      <Brand />
      <Text>This page does not exist.</Text>
      <nav className={linkRow}>
        <Link to="/">Go home</Link>
        {avatarsQuery.data === undefined ? null : <Link to="/explore">Open the map</Link>}
      </nav>
    </main>
  );
}
