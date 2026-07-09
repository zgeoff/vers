import { afterEach, mock } from 'bun:test';

// spied module namespaces persist across files in bun's single-process run;
// restoring after each test keeps a suite's mocks from leaking into the next
afterEach(() => {
  mock.restore();
});
