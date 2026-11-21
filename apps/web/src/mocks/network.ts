import { createTestNetwork } from '@zgeoff/testing/fetch';
import { handlers } from './handlers';

export const network = createTestNetwork({ handlers });
