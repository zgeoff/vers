import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { HomeContent } from '../../routes/-home/home-content';
import { toSessionHeaders } from '../rpc/to-session-headers';
import { tryReadCurrentUser } from './try-read-current-user';

export const getHomeContent = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await tryReadCurrentUser(toSessionHeaders(getRequestHeaders()));
  const Renderable = await renderServerComponent(<HomeContent result={result} />);

  return { Renderable };
});
