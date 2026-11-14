# device-takeover

A player signs in on a second device while a run plays on the first. The sign-in shows "You are
logged in elsewhere", and Confirm ends the first device's session. The second device picks the run
up, and the first device learns of the takeover on its next call to the server: it shows the
"Playing on another device" dialog, or goes to the login page.

Sign up an account first, as the signup journey does, with a run name of its own. A run ends on its
own after about 15 s, so start the second device's sign-in as soon as the `db query` shows the run
`active`.

## Journey

```bash
bun verify use --feature device-takeover
bun verify action navigate-route --path /explore/node/0_0
bun verify browser click --role link --name "Click to start"
bun verify db query "select id, status from activities where status = 'active'"
bun verify action second-device-sign-in --email wv-k7m@qa.versidle.com --password Verify-pass-123
bun verify action navigate-route --device second --path /activity
bun verify action read-game-state --device second
bun verify action set-network --network offline
bun verify action set-network --network online
bun verify browser snapshot
bun verify db query "select count(*) as sessions from sessions s join users u on u.id = s.user_id where u.email = 'wv-k7m@qa.versidle.com'"
```

Run the `db query` for the active run again until it gives a row, for up to 15 s. The `set-network`
pair makes the first device call the server at once.

## End state

- `second-device-sign-in` gives `data.tookOver: true`.
- `read-game-state --device second` shows a `liveRun` with the `id` of the active run.
- The `snapshot` shows the `Playing on another device` dialog, or a page on `/login` whose
  `redirect` names a game page such as `/explore`. A `redirect` that starts with `/_serverFn` is a
  bug.
- The last `db query` gives `sessions` of 1.
