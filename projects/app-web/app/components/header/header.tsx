import { Brand, Button, Icon } from '@vers/design-system';
import { Link as RRLink } from 'react-router';
import { toggleNavigationVisible } from '../../state/toggle-navigation-visible';
import { Routes } from '../../types';
import * as styles from './header.styles';

export function Header() {
  return (
    <header className={styles.header}>
      <section className={styles.leftContainer} />

      <section className={styles.centerContainer}>
        <RRLink to={Routes.Nexus}>
          <Brand className={styles.brand} size="lg" />
        </RRLink>
      </section>

      <section className={styles.rightContainer}>
        <Button
          aria-label="Toggle navigation"
          variant="transparent"
          onClick={toggleNavigationVisible}
        >
          <Icon.Menu size="24" />
        </Button>
      </section>
    </header>
  );
}
