# offline-run

A player starts a run from a node of the world map, and plays it in the page while a SharedWorker
runs the simulation. When the network drops, the worker keeps the run and queues what the server has
not seen in its outbox. When the network returns, the worker sends the outbox, and the replay
service checks the run and marks it verified.

The map is a canvas, so the journey opens a node with `navigate-route`. Sign up an account first, as
the signup journey does. The journey plays one run online first, so the page has loaded the game's
code before the cut.

## Journey

```bash
bun verify use --feature offline-run
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
bun verify browser click --role button --name "END RUN"
bun verify action set-network --network offline
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
bun verify action read-game-state
bun verify browser click --role button --name "END RUN"
bun verify db query "select id, status from activities order by created_at"
bun verify action set-network --network online
bun verify action read-game-state
bun verify db query "select id, status, appended_head, verified_head, verified_at from activities order by created_at"
```

## End state

- `set-network --network offline` gives `data.workers` of at least 1: the cut reached the worker.
- The first `read-game-state` shows a `liveRun`, and `outbox.activityStarts` holds that run's
  `activityID`.
- The first `db query` lists only the online run: the server has not seen the offline one.
- A few seconds after `online`, the second `read-game-state` shows an empty `outbox`. Run it again
  until it does, for up to 30 s.
- The last `db query` lists both runs, `stopped`, each with `verified_head` equal to `appended_head`
  and a `verified_at`.
