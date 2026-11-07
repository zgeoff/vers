# QA debug hook

From the console of a game page, `window.__versQA` reads the state of the
[writer worker](../architecture/game/glossary.md) and sets the simulation speed of a
[QA avatar](qa.md#accounts). [Manual QA](qa.md#debug-hook) lists the pages that carry the object.
[Game simulation](../architecture/game/game-simulation.md#checkpoint-streams) owns the writer
worker, and [offline reconcile](../architecture/game/offline-reconcile.md#worker-lifecycle) owns its
lifecycle, with the phases and flushes that its events record.

## Read the worker's state

Call `snapshot()` when a run behaves wrong, to see what the worker holds and what the server
refused:

```js
await window.__versQA.snapshot();
```

The call sends the writer worker one read-only message and changes none of its state. It resolves to
one object. These fields come from the worker:

- `phase`: the worker's lifecycle phase.
- `connectivityOnline`: whether the worker thinks it can reach the server.
- `liveRun`: the run the worker simulates now.
- `latestRun`: the avatar's most recent run with its XP. The worker takes the XP of the next run
  from this record.
- `outbox`: what the worker still has to deliver to the activity service. It holds the run starts,
  each with its number of attempts and the service's last refusal of it, and the
  [checkpoint](../architecture/game/glossary.md) batches.
- `writer`: the worker's ID and boot time.
- `simulationSpeed`: the current speed.
- `events`: the last 200 worker events.

These fields come from the page:

- `tab`: the page's online flag, the browser's user agent, whether the browser has `SharedWorker`,
  and the last 50 run outcomes that the worker sent to this tab. Each outcome carries the ID of the
  worker that sent it and the time it arrived. The tab keeps the outcomes in session storage, so
  they survive a reload.
- `refusalCaptures`: every refusal capture in storage, from this tab or another. A call removes only
  the complete captures, so a `pending` capture comes back in the next call.
- `captureFailures`: each failure to store a capture.

### Refused starts

The worker begins to simulate a run before the activity service accepts its run start. The service
refuses a start that it cannot accept, such as one whose XP differs from the avatar's. The worker
then ends that run, and it drops each queued start whose run follows the refused one. The refusal
event holds the refused start, the ended run and the dropped starts. The worker also sends the
refusal to each tab as a run outcome.

A phone in airplane mode gives you no console while the refusal happens. The page therefore saves a
capture of each refusal outcome that reaches the tab, and the first `snapshot()` call after the
device reconnects returns it in `refusalCaptures`. [Refusal captures](qa-refusal-captures.md) lists
what a capture holds and where the page stores it.

### Events and connectivity

The events record lifecycle phases, start and flush outcomes, refusals, speed changes, and
connectivity changes. A start event holds the [chain index](../architecture/game/glossary.md) and
the XP that the worker gave the start. An `rpc` event records each request from the worker to the
activity service that failed in transport or came back with an error status, so you can tell whether
the worker reached the server.

The page's online flag in `tab` can disagree with `connectivityOnline`. The offline toggle in the
DevTools Network panel takes only the page offline. To take the worker offline, run
[`qa:cdp offline`](qa.md#driving-a-target) on the worker's target.

## Set the speed

```js
await window.__versQA.setSpeed(20);
await window.__versQA.setSpeed(1);
```

`setSpeed(n)` runs the live simulation `n` times faster than real time, for an integer `n` from 1 to
20, and resolves to the applied speed. The writer counts each real millisecond as `n` milliseconds
of simulation time, and each run still advances in the same fixed steps. A sped-up run therefore
produces the same checkpoint stream, hashes, rewards, and replay result as a real-time run.

The speed applies to live combat only. The worker still sends checkpoints to the activity service on
its real-time schedule, stamps each run's `playedAt` with the wall clock, and
[fast-forwards](../architecture/game/glossary.md) an offline gap at the normal rate.

The worker accepts a speed above 1 only for a QA avatar. For any other avatar, the call rejects with
an error. While the speed is above 1, the game routes show a `QA ×N` badge in the top right corner,
so a sped-up run is never mistaken for a real one. Every tab of the browser profile shares the one
writer worker, so the speed holds across those tabs. It resets to 1 when the worker restarts, which
happens when the profile's last game tab closes or reloads.

The activity service credits a QA avatar's
[offline budget](../architecture/game/game-simulation.md#the-offline-budget) at 20 times the wall
clock instead of 1, under the same cap as every other avatar, so a run at any speed up to 20 stays
inside the budget.
