# device-takeover

A player signs in on a second device while a run plays on the first. The sign-in shows "You are
logged in elsewhere", and Confirm ends the first device's session. The second device picks up the
run. The next time the first device calls the server, the server refuses the call, and the first
device shows the "Playing on another device" dialog or goes to the login page.

Run this journey last, after the [signup journey](./feature-signup.md) in the same `bun verify up`:
it signs the first device out. Put the account name you picked in the signup journey in place of
`RUN`. Before you start:

- The first device is the browser that `browser` commands drive. `navigate-route` and
  `read-game-state` act on it unless you pass `--device second`.
- `bun verify action second-device-sign-in` opens a second browser of its own, signs in, and clicks
  Confirm itself. Its `data.tookOver` says whether the sign-in asked to take over.
- A run ends by itself about 15 s after it starts. Run `second-device-sign-in` as soon as the
  `db query` after the start prints a row. In the database, a run is a row of `activities`.
- When the query prints no row within 15 s, or `read-game-state --device second` shows no `liveRun`,
  the run ended before the sign-in. Start this journey again from `use --feature`, with the same
  account.

## Journey

```bash
bun verify use --feature device-takeover
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
# run this query every 2 s until it prints a row
bun verify db query "select a.id from activities a join avatars v on v.id = a.avatar_id join users u on u.id = v.user_id where a.status = 'active' and u.email = 'wv-RUN@qa.versidle.com'"
bun verify action second-device-sign-in --email wv-RUN@qa.versidle.com --password Verify-pass-123
# expect data.tookOver: true
bun verify action navigate-route --device second --path /activity
bun verify action read-game-state --device second
# expect data.state.liveRun whose activityID is the id the query printed
# a reconnect makes the first device call the server at once
bun verify action set-network --network offline
bun verify action set-network --network online
bun verify browser snapshot
bun verify db query "select count(*) as sessions from sessions s join users u on u.id = s.user_id where u.email = 'wv-RUN@qa.versidle.com'"
```

## End state

- The `snapshot` shows the `Playing on another device` dialog, or `data.url` is on `/login`. On
  `/login`, the URL's `redirect` parameter names a game page, such as `/explore`. A `redirect` that
  starts with `/_serverFn` is a bug.
- The last `db query` prints `sessions` of 1.
