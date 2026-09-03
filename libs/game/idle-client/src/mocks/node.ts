import { resolveServiceURL } from '@vers/mock-services';
import { buildActivityMockHandlers } from '@vers/mock-services/activity';
import { setupServer } from 'msw/node';

export const server = setupServer(...buildActivityMockHandlers(resolveServiceURL('activity')));
