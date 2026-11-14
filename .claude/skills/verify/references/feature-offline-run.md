# offline-run

A player starts a run from a node of the world map. A SharedWorker in the browser plays the run.
While the network is down, the worker keeps playing, and holds each run start and checkpoint that
the server hasn't received in its outbox. When the network comes back, the worker sends its outbox.
The replay service, which `up` starts with the others, then replays each run and marks it verified
in the database.

Run this journey after the [signup journey](./feature-signup.md), in the same `bun verify up`, and
before device-takeover, which signs this browser out. Put the account name you picked in the signup
journey in place of `RUN`. Before you start:

- Open a map node with `bun verify action navigate-route`. The map is a canvas, which
  `browser click` can't reach.
- Play the first run online. It loads the game's code into the page, which the offline run needs.
- `bun verify action set-network --network offline` cuts the network for the page and its worker,
  and `--network online` brings it back.
- In the database, a run is a row of `activities`. A run ends by itself about 15 s after it starts;
  when `END RUN` is gone, the run ended first, and the journey goes on.

## Journey

```bash
bun verify use --feature offline-run
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
bun verify browser click --role button --name "END RUN"
bun verify action set-network --network offline
# expect data.workers of 1 or more: the worker lost its network too
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
bun verify action read-game-state
# expect data.state.liveRun, and an entry with its activityID in data.state.outbox.activityStarts
bun verify browser click --role button --name "END RUN"
bun verify db query "select a.id, a.status from activities a join avatars v on v.id = a.avatar_id join users u on u.id = v.user_id where u.email = 'wv-RUN@qa.versidle.com' order by a.created_at"
# expect one row, the online run, stopped: the server has no row for the offline run
bun verify action set-network --network online
# run read-game-state every 2 s, for up to 30 s, until activityStarts and checkpoints are empty
bun verify action read-game-state
# run this query every 2 s, for up to 30 s, until both rows have a verified_at
bun verify db query "select a.id, a.status, a.appended_head, a.verified_head, a.verified_at from activities a join avatars v on v.id = a.avatar_id join users u on u.id = v.user_id where u.email = 'wv-RUN@qa.versidle.com' order by a.created_at"
```

## End state

- The last `read-game-state` shows empty `activityStarts` and `checkpoints` in `data.state.outbox`.
- The last `db query` prints two rows, both `stopped`, each with `verified_head` equal to
  `appended_head` and a `verified_at`.
