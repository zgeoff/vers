# signup

A player signs up on `/signup` with an email address, enters the 6-character code the welcome email
carries, fills in the onboarding form, and creates a first avatar. The game then opens on
`/explore`. In this run the email goes to a stub that `read-email` reads.

Pick a run name of lowercase letters, such as `k7m`, and use it in the address and the username. The
other journeys sign up the same way, each with an account of its own.

## Journey

```bash
bun verify use --feature signup
bun verify browser goto /signup
bun verify browser type --role textbox --name Email --value wv-k7m@qa.versidle.com
bun verify browser click --role button --name Signup
bun verify action read-email --to wv-k7m@qa.versidle.com
bun verify browser type --role textbox --name "pin code 1 of 6" --value "<data.code from read-email>"
bun verify browser click --role button --name Verify
bun verify browser type --role textbox --name Username --value wv_k7m
bun verify browser type --role textbox --name Name --value "Verify Player"
bun verify browser type --role textbox --name Password --value Verify-pass-123
bun verify browser type --role textbox --name "Confirm Password" --value Verify-pass-123
bun verify browser snapshot
bun verify browser click --ref "<ref of the Agree to terms label>"
bun verify browser click --role button --name "Create an Account"
bun verify browser type --role textbox --name Name --value Wvkm
bun verify browser click --role button --name "Create Avatar"
bun verify browser snapshot
bun verify db query "select u.username, a.name from users u join avatars a on a.user_id = u.id where u.email = 'wv-k7m@qa.versidle.com'"
```

Typing the code into the first box fills all six. An avatar name takes letters only.

## End state

- `Verify` moves the page to `/onboarding`, and `Create an Account` to `/avatars/create`.
- The last `snapshot` is on `/explore`, with a `Switch avatar (Wvkm)` link in the game's navigation.
- The `db query` gives one row: your username and your avatar's name.
