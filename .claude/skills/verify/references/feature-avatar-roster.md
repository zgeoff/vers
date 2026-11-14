# avatar-roster

A player keeps several avatars. The rail's `Switch avatar (<name>)` link opens the roster on
`/avatars`, which lists each avatar and marks the active one. `+ Create avatar` adds one, and
creating it makes it active. Clicking another avatar's card makes that one active, and the server
keeps the choice, so a fresh page load still plays as it.

Sign up an account first, as the signup journey does, with a run name of its own and an avatar named
`Wvalpha`.

## Journey

```bash
bun verify use --feature avatar-roster
bun verify browser click --role link --name "Switch avatar (Wvalpha)"
bun verify browser click --role link --name "+ Create avatar"
bun verify browser type --role textbox --name Name --value Wvbeta
bun verify browser click --role button --name "Create Avatar"
bun verify browser click --role link --name "Switch avatar (Wvbeta)"
bun verify browser snapshot
bun verify browser click --role button --name "<the Wvalpha card's name from the snapshot>"
bun verify browser goto /explore
bun verify browser snapshot
bun verify db query "select a.name from active_avatars aa join avatars a on a.id = aa.avatar_id join users u on u.id = aa.user_id where u.email = 'wv-k7m@qa.versidle.com'"
```

## End state

- After `Create Avatar`, the page is on `/explore`.
- The first `snapshot` lists two avatar cards, and only the `Wvbeta` card says `Active`.
- After `goto`, a fresh page load, the second `snapshot` has a `Switch avatar (Wvalpha)` link.
- The `db query` gives one row, `Wvalpha`.
