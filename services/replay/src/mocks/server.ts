import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { setupServer } from 'msw/node';

export const server = setupServer(...buildKeysMockHandlers(resolveServiceURL('keys')));
