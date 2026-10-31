import { createFlyMachineFleet } from '../bugsink/create-fly-machine-fleet';
import { wakeMachines } from '../bugsink/wake-machines';

// The Bugsink app suspends its only machine when idle, and `flyctl ssh console` refuses to connect
// to an app with no started machine, so the vacuum job wakes every machine first. Needs
// FLY_API_TOKEN.

const outcome = await wakeMachines(createFlyMachineFleet('vers-bugsink'), {
  pollIntervalMs: 5000,
  timeoutMs: 120_000,
});

if (outcome === 'timed-out') {
  console.error('::error::no vers-bugsink machine reached the started state within 120s');
  process.exit(1);
}
