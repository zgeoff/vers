# device-takeover

A player signs in on a second device while a run plays on the first. The sign-in shows "You are
logged in elsewhere", and Confirm ends the first device's session. The second device picks up the
run. The next time the first device calls the server, the server refuses the call, and the first
device shows the "Playing on another device" dialog or goes to the login page.

Run this journey after the [signup journey](./feature-signup.md), in the same `up`, with its
account. Before you start:

- Every command without `--device second` acts on the first device, the browser that `browser`
  commands drive.
- `bun verify action second-device-sign-in` opens a new browser context, signs in, and clicks
  Confirm itself. Its `data.tookOver` says whether the sign-in asked to take over.
- A run ends by itself about 15 s after it starts. Run `second-device-sign-in` as soon as the
  `db query` after the start prints a row. In the database, a run is a row of `activities`.
- When the run ended before the sign-in, start this journey again from `use --feature`.

## Journey

```bash
bun verify use --feature device-takeover
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
# run this query every 2 s until it prints a row
bun verify db query "select a.id from activities a join avatars v on v.id = a.avatar_id join users u on u.id = v.user_id where a.status = 'active' and u.email = 'wv-RUN@qa.versidle.com'"
bun verify action second-device-sign-in --email wv-RUN@qa.versidle.com --password Verify-pass-123
bun verify action navigate-route --device second --path /activity
bun verify action read-game-state --device second
# a reconnect makes the first device call the server at once
bun verify action set-network --network offline
bun verify action set-network --network online
bun verify browser snapshot
bun verify db query "select count(*) as sessions from sessions s join users u on u.id = s.user_id where u.email = 'wv-RUN@qa.versidle.com'"
```

## End state

- `second-device-sign-in` prints `data.tookOver: true`.
- `read-game-state --device second` shows `data.state.liveRun` whose `activityID` is the `id` that
  the first `db query` printed.
- The `snapshot` shows the `Playing on another device` dialog, or `data.url` is on `/login`. On
  `/login`, the URL's `redirect` parameter names a game page, such as `/explore`. A `redirect` that
  starts with `/_serverFn` is a bug.
- The last `db query` prints `sessions` of 1.
