import { css } from '@vers/styled-system/css';

export const profileSection = css({
  alignSelf: 'flex-start',
  borderBottomWidth: '[1px]',
  borderColor: 'gray.700',
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '3',
  paddingBottom: '3',
  width: 'full',
});

export const profileInfoRow = css({
  marginBottom: '2',
});

export const profileInfoLabel = css({
  color: 'gray.400',
  fontWeight: 'bold',
  marginBottom: '1',
});

export const profileInfoValue = css({
  marginBottom: '1',
});

export const twoFactorDescription = css({
  color: 'gray.400',
  marginBottom: '4',
});
