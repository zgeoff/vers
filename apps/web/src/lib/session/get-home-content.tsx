import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { HomeContent } from '../../routes/-home/home-content';
import { tryReadCurrentUser } from './try-read-current-user';

export const getHomeContent = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await tryReadCurrentUser();
  const Renderable = await renderServerComponent(<HomeContent result={result} />);

  return { Renderable };
});
