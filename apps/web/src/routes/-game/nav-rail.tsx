import { Link, useRouteContext, useRouterState } from '@tanstack/react-router';
import { Icon } from '@vers/design-system';
import type { FlagKey } from '@vers/flags';
import { css, cx } from '@vers/styled-system/css';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { AvatarChip } from './avatar-chip';

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

const RAIL_GROUPS: ReadonlyArray<ReadonlyArray<RailItem>> = [
  [{ Glyph: Icon.Encounter, label: 'Engage', to: '/activity' }],
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
  // its own transition group so it stays live and on top through a route transition instead of
  // being flattened into the root snapshot and painted under the sheet's scrim
  viewTransitionName: 'nav-rail',
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
  height: 'rail',
  justifyContent: 'center',
  paddingX: '2',
  paddingY: '2',
  transitionDuration: 'fast',
  transitionProperty: '[color, background-color, border-color]',
  width: 'rail',
  _hover: { borderColor: 'border.strong', color: 'text.primary' },
});

const railButtonActive = css({
  backgroundColor: 'text.primary',
  borderColor: 'text.primary',
  color: 'bg.panel',
});

const railButtonDisabled = css({
  cursor: '[not-allowed]',
  opacity: '[0.4]',
  _hover: { borderColor: 'border', color: 'text.muted' },
});

const railGlyph = css({ fontSize: '2xl', lineHeight: '[1]' });

const railLabel = css({
  fontFamily: 'display',
  fontSize: '2xs',
  fontWeight: 'bold',
  letterSpacing: 'wider',
  textTransform: 'uppercase',
});

export function NavRail() {
  const routeContext = useRouteContext({ from: '/_game' });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const idleWorkerHandle = useIdleWorkerHandle();
  const hasActivity = idleWorkerHandle.activity !== undefined;

  return (
    <nav aria-label="Game navigation" className={rail}>
      <AvatarChip />
      <span aria-hidden className={divider} />
      {RAIL_GROUPS.map((group, index) => (
        <RailGroup
          key={group[0]?.to ?? index}
          flags={routeContext.flags}
          hasActivity={hasActivity}
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
  readonly hasActivity: boolean;
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
      {visible.map((item) =>
        // the engagement view has nothing to show without a running activity — a click would only
        // bounce off its guard, so the rail entry stays inert until one is live
        item.to === '/activity' && !props.hasActivity ? (
          <span key={item.to} aria-disabled="true" className={cx(railButton, railButtonDisabled)}>
            <item.Glyph className={railGlyph} />
            <span className={railLabel}>{item.label}</span>
          </span>
        ) : (
          <Link
            key={item.to}
            aria-current={isActive(props.pathname, item.to) ? 'page' : undefined}
            className={cx(railButton, isActive(props.pathname, item.to) && railButtonActive)}
            to={item.to}
          >
            <item.Glyph className={railGlyph} />
            <span className={railLabel}>{item.label}</span>
          </Link>
        ),
      )}
    </>
  );
}

function isActive(pathname: string, to: RailTarget): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
