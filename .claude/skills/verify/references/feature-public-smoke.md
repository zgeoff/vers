# public-smoke

Check that a visitor who is not signed in gets the game's landing page, and that the web app, its
RPC proxy and a service behind the proxy all answer. Every command in the journey is a read, so it
writes no game data on `local` or on `prod`, the deployed game at versidle.com.

- On `local`, run this journey first after `bun verify up`. The browser that `up` opens has no
  session yet.
- On `prod`, run only this journey. Run `bun verify use --target prod`, `bun verify attach` and
  `bun verify doctor` first, then the journey.

On `prod`, the doctor's `served-build` check fails when main holds changes to the web app that
versidle.com does not serve yet. That happens between a merge and the end of its deploy. Wait for
the `Main` workflow's deploy of that merge to finish, run `git fetch origin main`, and run
`bun verify doctor` again. When it still fails after the deploy finished, report the failure.

## Journey

```bash
bun verify use --feature public-smoke
bun verify action load-page --path /
bun verify browser snapshot
bun verify http request --path /health
bun verify http request --method POST --path /api/rpc/avatar/getAvatars --body '{"json":{}}'
```

`load-page` waits until the page's network is idle, so `data.errors` holds each console error the
page raised while it loaded. The last request calls the avatar service through the web app's proxy
with no session. oRPC wraps each request body and each answer in a `json` field, so the answer's
fields sit under `data.json.json`.

## End state

- `load-page` prints `data.status` 200, `data.url` with the path `/`, and `data.errors` as `[]`.
- The `snapshot` has the `Welcome to vers` heading and the `Log in` and `Sign up` links.
- The `/health` request prints `data.status` 200 and `data.json.ok` as `true`. On `prod`,
  `data.json.commit` is the commit that the doctor's `served-build` check printed as `served`. On
  `local`, `data.json.commit` is `null`.
- The RPC request prints `data.status` 401, with `data.json.json.code` `UNAUTHORIZED` and
  `data.json.json.data.reason` `missing-session`.

When a line of the end state differs, skip `done` and report what you saw.
