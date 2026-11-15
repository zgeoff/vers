# public-smoke

Check that a visitor who is not signed in gets the game's landing page, and that the web app, its
RPC proxy and a service behind the proxy all answer. Every command in the journey is a read, so it
writes no game data on `local` or on `prod`, the deployed game at versidle.com.

On `local`, run this journey first after `bun verify up`, while the browser `up` opened has no
session.

On `prod`, run only this journey:

1. Run `bun verify use --target prod`, then `bun verify attach`. `attach` opens a local Chromium on
   versidle.com and needs no credential.
2. Run `bun verify doctor`. Expect every check to pass, and `served-build` to print the `served`
   commit.
3. When `served-build` fails, main on GitHub holds web app changes that versidle.com does not serve
   yet. Wait until the `Main` workflow run for that merge finishes. Then run `git fetch origin main`
   and `bun verify doctor` again. When it still fails, stop and report the failure.
4. Run the journey.

## Journey

```bash
bun verify use --feature public-smoke
bun verify action load-page --path /
bun verify browser snapshot
bun verify http request --path /health
bun verify http request --method POST --path /api/rpc/avatar/getAvatars --body '{"json":{}}'
```

`load-page` waits until the page's network is idle, so `data.errors` holds each console error the
page raised while it loaded. `http request` prints the parsed response body as `data.json`. The last
request calls the avatar service through the proxy with no session. oRPC wraps each body in a `json`
field of its own, so the service's answer sits under `data.json.json`.

## End state

- `load-page` prints `data.status` 200, `data.url` with the path `/`, and `data.errors` as `[]`.
- The `snapshot` has the `Welcome to vers` heading and the `Log in` and `Sign up` links.
- The `/health` request prints `data.status` 200 and `data.json.ok` as `true`. On `prod`,
  `data.json.commit` is the `served` commit from step 2. On `local`, `data.json.commit` is `null`.
- The RPC request prints `data.status` 401, with `data.json.json.code` `UNAUTHORIZED` and
  `data.json.json.data.reason` `missing-session`.

When every line matches, run `bun verify done`. When a line differs, skip `done` and report what you
saw.
