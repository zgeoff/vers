import { Brand, Icon, Text } from '@vers/design-system';
import { cx } from '@vers/styled-system/css';
import type { IconType } from 'react-icons/lib';
import type { NavLinkRenderProps } from 'react-router';
import { NavLink } from '~/components/nav-link';
import { setNavigationVisible } from '~/state/set-navigation-visible';
import { useNavigationVisible } from '~/state/use-navigation-visible';
import { Routes } from '~/types';
import * as styles from './side-navigation.styles';

export function SideNavigation() {
  const isNavVisible = useNavigationVisible();

  const handleHideNav = () => {
    if (isNavVisible) {
      setNavigationVisible(false);
    }
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.navOverlay({ isVisible: isNavVisible })} onClick={handleHideNav} />
      {/* eslint-enable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}

      <nav className={cx(styles.nav, !isNavVisible && styles.navHidden)}>
        <Brand className={styles.brand} size="lg" />
        <section className={styles.navSection}>
          <Text className={styles.navSectionTitle}>Game</Text>
          <ul className={styles.navList}>
            {Object.values(GAME_LINKS).map((link) => renderLink(link))}
          </ul>
        </section>
        <section className={styles.navSection}>
          <Text className={styles.navSectionTitle}>Community</Text>
          <ul className={styles.navList}>
            {Object.values(COMMUNITY_LINKS).map((link) => renderLink(link))}
          </ul>
        </section>
        <section className={styles.navSection}>
          <Text className={styles.navSectionTitle}>Settings</Text>
          <ul className={styles.navList}>
            {Object.values(SETTINGS_LINKS).map((link) => renderLink(link))}
          </ul>
        </section>
      </nav>
    </>
  );
}

interface LinkData {
  Icon: IconType;
  label: string;
  notImplemented?: boolean;
  route: string;
}

function renderLink(link: LinkData) {
  const navLinkClassName = (props: NavLinkRenderProps) =>
    styles.navLink({
      isActive: props.isActive,
      isDisabled: link.notImplemented,
    });

  return (
    <li key={link.route} className={styles.navListItem}>
      <NavLink
        className={navLinkClassName}
        to={link.route}
        onClick={() => setNavigationVisible(false)}
      >
        <link.Icon className={styles.navLinkIcon} />
        {link.label}
      </NavLink>
    </li>
  );
}

const GAME_LINKS: Record<string, LinkData> = {
  [Routes.Nexus]: {
    Icon: Icon.Nexus,
    label: 'Nexus',
    route: Routes.Nexus,
  },
  [Routes.Aether]: {
    Icon: Icon.Aether,
    label: 'Aether',
    route: Routes.Aether,
  },
  [Routes.Avatar]: {
    Icon: Icon.Avatar,
    label: 'Avatar',
    route: Routes.Avatar,
  },
  [Routes.Stash]: {
    Icon: Icon.Stash,
    label: 'Stash',
    notImplemented: true,
    route: Routes.Stash,
  },
  [Routes.Market]: {
    Icon: Icon.Market,
    label: 'Market',
    notImplemented: true,
    route: Routes.Market,
  },
  [Routes.Forge]: {
    Icon: Icon.Forge,
    label: 'Forge',
    notImplemented: true,
    route: Routes.Forge,
  },
  [Routes.Arena]: {
    Icon: Icon.Arena,
    label: 'Arena',
    notImplemented: true,
    route: Routes.Arena,
  },
  [Routes.Wiki]: {
    Icon: Icon.Wiki,
    label: 'Wiki',
    notImplemented: true,
    route: Routes.Wiki,
  },
};

const COMMUNITY_LINKS: Record<string, LinkData> = {
  [Routes.Guilds]: {
    Icon: Icon.Guild,
    label: 'Guilds',
    notImplemented: true,
    route: Routes.Guilds,
  },
  [Routes.Leaderboards]: {
    Icon: Icon.Leaderboard,
    label: 'Leaderboards',
    notImplemented: true,
    route: Routes.Leaderboards,
  },
};

const SETTINGS_LINKS: Record<string, LinkData> = {
  [Routes.Account]: {
    Icon: Icon.Account,
    label: 'Account',
    route: Routes.Account,
  },
};
