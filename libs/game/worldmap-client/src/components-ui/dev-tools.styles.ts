import { css } from '@vers/styled-system/css';

export const container = css({
  backgroundColor: 'bg.panel',
  padding: '2',
  position: 'absolute',
  right: '2',
  top: '2',
  zIndex: '[2]',
});

export const perfHUD = css({
  borderTopColor: 'border',
  borderTopWidth: '[1px]',
  color: 'text.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
  marginTop: '2',
  paddingTop: '2',
});

export const perfLine = css({
  whiteSpace: '[pre]',
});
