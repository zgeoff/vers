import { Link } from '@tanstack/react-router';
import type { UserData } from '@vers/contract-user';
import { Brand, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

interface HomeHeroProps {
  readonly user: UserData | null;
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
  return (
    <section className={heroStyles}>
      <Brand size="xl" />
      {props.user === null ? (
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
          <Heading level={2}>Welcome back, {props.user.name}.</Heading>
          <nav className={linkRowStyles}>
            <Link to="/respite">Enter game</Link>
          </nav>
        </>
      )}
    </section>
  );
}
