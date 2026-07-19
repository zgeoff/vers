import { Link, useRouteContext, useRouterState } from '@tanstack/react-router';
import { Icon } from '@vers/design-system';
import type { FlagKey } from '@vers/flags';
import { css, cx } from '@vers/styled-system/css';

type RailTarget =
  | '/activity'
  | '/avatar'
  | '/codex'
  | '/explore'
  | '/market'
  | '/respite'
  | '/settings'
  | '/stash';

interface RailItem {
  readonly Glyph: typeof Icon.Respite;
  readonly flag?: FlagKey;
  readonly label: string;
  readonly to: RailTarget;
}

/**
 * Rail order mirrors the three planes: the pinned activity, the two canvas destinations, then the
 * meta screens. Each inner array renders as a group separated by a divider.
 */
const RAIL_GROUPS: ReadonlyArray<ReadonlyArray<RailItem>> = [
  [{ Glyph: Icon.Encounter, label: 'Engagement', to: '/activity' }],
  [
    { Glyph: Icon.Respite, label: 'Respite', to: '/respite' },
    { Glyph: Icon.Explore, label: 'Explore', to: '/explore' },
  ],
  [
    { Glyph: Icon.Avatar, label: 'Avatar', to: '/avatar' },
    { Glyph: Icon.Stash, label: 'Stash', to: '/stash' },
    { Glyph: Icon.Market, flag: 'market', label: 'Market', to: '/market' },
    { Glyph: Icon.Wiki, label: 'Codex', to: '/codex' },
    { Glyph: Icon.Account, label: 'Settings', to: '/settings' },
  ],
];

const rail = css({
  alignItems: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  position: 'fixed',
  right: '4',
  top: '[50%]',
  transform: 'translateY(-50%)',
  zIndex: '[10]',
});

const divider = css({
  backgroundColor: 'border',
  height: '[1px]',
  marginX: '2',
  marginY: '1',
});

const railButton = css({
  alignItems: 'center',
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'md',
  borderWidth: '[1px]',
  color: 'text.muted',
  cursor: '[pointer]',
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  paddingX: '2',
  paddingY: '2',
  transitionDuration: 'fast',
  transitionProperty: '[color, background-color, border-color]',
  width: '[3.5rem]',
  _hover: { borderColor: 'border.strong', color: 'text.primary' },
});

const railButtonActive = css({
  backgroundColor: 'text.primary',
  borderColor: 'text.primary',
  color: 'bg.panel',
});

const railGlyph = css({ fontSize: 'xl', lineHeight: '[1]' });
const railLabel = css({ fontSize: '[0.5rem]', letterSpacing: 'wider', textTransform: 'uppercase' });

/**
 * The always-on navigation rail: a persistent vertical stack pinned to the right edge, above the
 * canvas and any ambient sheet. Focus targets swap the canvas scene; ambient targets open a sheet.
 */
export function NavRail() {
  const routeContext = useRouteContext({ from: '/_game' });
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav aria-label="Game navigation" className={rail}>
      {RAIL_GROUPS.map((group, index) => (
        <RailGroup
          key={group[0]?.to ?? index}
          flags={routeContext.flags}
          items={group}
          pathname={pathname}
          showDivider={index > 0}
        />
      ))}
    </nav>
  );
}

interface RailGroupProps {
  readonly flags: Partial<Record<FlagKey, boolean>>;
  readonly items: ReadonlyArray<RailItem>;
  readonly pathname: string;
  readonly showDivider: boolean;
}

function RailGroup(props: Readonly<RailGroupProps>) {
  const visible = props.items.filter((item) => !item.flag || props.flags[item.flag] === true);

  if (visible.length === 0) {
    return null;
  }

  return (
    <>
      {props.showDivider ? <span aria-hidden className={divider} /> : null}
      {visible.map((item) => (
        <Link
          key={item.to}
          aria-current={isActive(props.pathname, item.to) ? 'page' : undefined}
          className={cx(railButton, isActive(props.pathname, item.to) && railButtonActive)}
          to={item.to}
        >
          <item.Glyph className={railGlyph} />
          <span className={railLabel}>{item.label}</span>
        </Link>
      ))}
    </>
  );
}

function isActive(pathname: string, to: RailTarget): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
