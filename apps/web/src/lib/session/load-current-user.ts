import { createServerFn } from '@tanstack/react-start';
import { readCurrentUser } from './read-current-user';

export const loadCurrentUser = createServerFn({ method: 'GET' }).handler(() => readCurrentUser());
