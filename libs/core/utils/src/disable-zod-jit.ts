import * as z from 'zod';

// zod probes `new Function('')` the first time it builds an object schema, and a script-src without
// 'unsafe-eval' reports the caught call as a policy violation; jitless skips the probe
z.config({ jitless: true });
