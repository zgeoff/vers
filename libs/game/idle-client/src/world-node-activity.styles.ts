import { css } from '@vers/styled-system/css';

export const container = css({
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  height: '96',
  maxHeight: 'dvh',
  userSelect: 'none',
  width: 'full',
});

export const section = css({
  display: 'flex',
  flex: '1',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '2',
});

export const avatarSection = css({
  flex: '1',
});

export const enemySection = css({
  alignItems: 'flex-start',
  columnGap: '2',
  display: 'flex',
  flex: '1',
  flexDirection: 'column-reverse',
  flexWrap: 'wrap-reverse',
  justifyContent: 'flex-end',
  rowGap: '3',
});
