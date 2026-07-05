import { css } from '@vers/styled-system/css';
import { Outlet } from 'react-router';

const container = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 'auto',
  marginRight: 'auto',
  paddingTop: '8',
  width: {
    '2xl': '1/2',
    base: '4/5',
    lg: '2/3',
    md: '4/5',
    sm: '4/5',
    xl: '1/2',
  },
});

export function PublicLayout() {
  return (
    <main className={container}>
      <Outlet />
    </main>
  );
}

export default PublicLayout;
