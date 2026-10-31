# Refusal captures

A device in airplane mode has no console to reach, so a game page with the
[debug hook](qa.md#debug-hook) captures a refused run itself, the moment the tab receives the
refused outcome. The capture waits in the page's local storage until a `snapshot()` call reads it
after the device reconnects. The call returns the captures in `refusalCaptures`, beside the current
worker state, so one call after reconnect shows both the state at the refusal and the state now.

## What a capture holds

When the tab receives a refused outcome, the page writes a capture with the time, the `tab` record
and the outcome to local storage at once, marked `pending`. It then adds the worker snapshot and
marks the capture `complete`. A worker that fails, or that gives no answer within the hook's wait of
a few seconds, adds its error in place of the snapshot. Each capture has a local storage key of its
own, so a tab that writes one capture touches no other capture, with one exception: a new capture
past the limit evicts the oldest one, whichever tab owns it.

## How a snapshot reads captures

A `snapshot()` call first waits for the captures this page is still taking, including one that a
refusal starts during the wait, so it returns each of them complete, even when the hook registered
again in between. The wait ends after twice the hook's worker wait, and a capture still in flight
then comes back as `pending` on purpose, so a stream of refusals cannot hold `snapshot()` forever. A
later call returns that capture complete once its worker answers. After the wait, the call returns
every saved capture in `refusalCaptures`, oldest first, and removes the complete ones from storage.
The call reads the saved captures before it asks the worker for the current state, so a hung worker
still lets the call return them, with `workerError` in place of the worker state.

A storage access, read or write that fails, such as on a full quota or a blocked origin, goes to the
error backend and appears in `captureFailures` on the next snapshot. The capture goes on with what
it could read.

## Intended behaviours

Three behaviours follow from the design, and each is intended:

- A snapshot in one tab can return another tab's capture as `pending`. A tab waits only for its own
  captures, because it cannot reach another tab's worker request. The capture stays in storage, and
  the next call returns it complete.
- Storage keeps the 10 newest captures, so an 11th capture removes the oldest one even while that
  one is still `pending`, and its worker answer then has nothing to join. The limit keeps a phone's
  storage quota from filling while refusals repeat offline.
- A `pending` capture leaves storage at the first snapshot after it is 10 minutes old, because only
  a closed page leaves a capture pending that long. A phone throttles a hidden tab's timers to about
  once a minute, so a shorter limit would remove a capture that a live tab is still finishing.
