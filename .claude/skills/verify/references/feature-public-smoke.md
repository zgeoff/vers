# public-smoke

A visitor who is not signed in opens `/` and sees the landing page: a `Welcome to vers` heading with
`Log in` and `Sign up` links. The web app answers `/health` with `{ "ok": true, "commit": ... }`.
The browser reaches the activity and avatar services through the web app's proxy under `/api/rpc/`.
An anonymous call there gets the service's typed `UNAUTHORIZED` answer, which shows that the web
app, the proxy and the service all answer.

Run this journey on `local` first after each `up`, while the browser is signed out. On `prod`, it is
the only journey: run `bun verify use --target prod`, then `bun verify attach` and
`bun verify doctor`. Every command in it is a read, so it writes no game data on either target.

On `prod`, the doctor's `served-build` check fails while versidle.com serves a commit that main has
changed the web app since, as it does between a merge and the end of its deploy. Wait for the
deploy, run `git fetch origin main`, then run `bun verify doctor` again.

## Journey

```bash
bun verify use --feature public-smoke
bun verify action load-page --path /
bun verify browser snapshot
bun verify http request --path /health
bun verify http request --method POST --path /api/rpc/avatar/getAvatars --body '{"json":{}}'
```

`load-page` waits until the page's network is idle, so `data.errors` holds each console error the
page raised while it loaded.

## End state

- `load-page` prints `data.status` 200, `data.url` on `/`, and `data.errors` as `[]`.
- The `snapshot` has the `Welcome to vers` heading and the `Log in` and `Sign up` links.
- The `/health` request prints `data.status` 200 and `data.json.ok` as `true`. On `prod`,
  `data.json.commit` is the commit that the doctor's `served-build` check printed as `served`. On
  `local`, it is `null`.
- The RPC request prints `data.status` 401, with `data.json.json.code` `UNAUTHORIZED` and
  `data.json.json.data.reason` `missing-session`.
