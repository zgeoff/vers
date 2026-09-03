import { createMiddleware, createStart } from '@tanstack/react-start';
import { logger } from './server/logger';
import { reportFunctionFault } from './server/report-function-fault';
import { shouldReportFunctionFault } from './server/should-report-function-fault';

// Start folds a throw from a server function into the serialised result inside its own middleware
// chain, so a request-level middleware sees a 200 and never the error; a global function
// middleware is the one server-side place that observes every server function's fault.
const reportFaults = createMiddleware({ type: 'function' }).server(async (ctx) => {
  try {
    return await ctx.next();
  } catch (error) {
    if (shouldReportFunctionFault(error)) {
      reportFunctionFault(error, logger);
    }

    throw error;
  }
});

export const startInstance = createStart(() => ({ functionMiddleware: [reportFaults] }));
