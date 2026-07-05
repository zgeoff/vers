import { css } from '@vers/styled-system/css';

export const avatarInfo = css({
  backgroundColor: 'gray.900',
  borderColor: 'gray.700',
  borderWidth: '[1px]',
  boxShadow: 'md',
  overflow: 'hidden',
  padding: '2',
  position: 'relative',
  rounded: 'md',
});

export const avatarName = css({
  marginBottom: '0',
  position: 'relative',
  textAlign: 'right',
  zIndex: '[1]',
});

export const avatarImage = css({
  left: '[-80px]',
  objectFit: 'cover',
  objectPosition: 'top left',
  position: 'absolute',
  top: '[-90px]',
});
