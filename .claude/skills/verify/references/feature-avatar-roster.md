# avatar-roster

A player keeps several avatars. The `Switch avatar (<name>)` link in the game's navigation opens the
roster on `/avatars`, which lists a card for each avatar and marks the active one `Active`.
`+ Create avatar` adds an avatar and makes it the active one. A click on another avatar's card makes
that avatar active. The server stores the choice, so a fresh page load still plays as that avatar.

Run this journey after the [signup journey](./feature-signup.md), in the same `bun verify up`. Put
the account name you picked there in place of `RUN`. The signup journey made the avatar `WvRUN`, and
this journey adds `WvRUNb`. To run this journey again, run `bun verify up --restart` and the signup
journey first: avatar names are unique, so a second `WvRUNb` fails.

## Journey

```bash
bun verify use --feature avatar-roster
bun verify browser click --role link --name "Switch avatar (WvRUN)"
bun verify browser click --role link --name "+ Create avatar"
bun verify browser type --role textbox --name Name --value WvRUNb
bun verify browser click --role button --name "Create Avatar"
# expect data.url on /explore
bun verify browser click --role link --name "Switch avatar (WvRUNb)"
bun verify browser snapshot
# a card's button name starts with its avatar's name, such as "WvRUN Level 1 · Trade"
bun verify browser click --role button --name "<the button name of the WvRUN card in the snapshot>"
# goto loads the page from the server, so it shows what the server stored
bun verify browser goto /explore
bun verify browser snapshot
bun verify db query "select a.name from active_avatars aa join avatars a on a.id = aa.avatar_id join users u on u.id = aa.user_id where u.email = 'wv-RUN@qa.versidle.com'"
```

## End state

- The first `snapshot` lists two avatar cards, and only the `WvRUNb` card says `Active`.
- The second `snapshot` has a `Switch avatar (WvRUN)` link.
- The `db query` prints one row, `WvRUN`.
