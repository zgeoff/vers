import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Brand, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';

interface HomeHeroProps {
  readonly orpc: OrpcQueryUtils;
}

const heroStyles = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  textAlign: 'center',
});

const linkRowStyles = css({ display: 'flex', gap: '4', justifyContent: 'center' });

export function HomeHero(props: HomeHeroProps) {
  const query = useQuery(props.orpc.user.getCurrentUser.queryOptions({ input: {} }));

  return (
    <section className={heroStyles}>
      <Brand size="xl" />
      {!query.isPending &&
        (query.error ? (
          <>
            <Heading level={2}>Welcome to vers</Heading>
            <Text>Sign in to enter the game, or create an account to get started.</Text>
            <nav className={linkRowStyles}>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </nav>
          </>
        ) : (
          <>
            <Heading level={2}>Welcome back, {query.data.name}.</Heading>
            <nav className={linkRowStyles}>
              <Link to="/respite">Enter game</Link>
            </nav>
          </>
        ))}
    </section>
  );
}
