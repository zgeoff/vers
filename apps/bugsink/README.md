# app-bugsink

Self-hosted [Bugsink](https://www.bugsink.com) error tracker, deployed on Fly as `vers-bugsink`.
Browser and server exceptions ingest here over the Sentry protocol: each vers app has its own
Bugsink project, and that project's DSN is the only wiring an app carries.

This directory holds Fly config plus a thin image (`Dockerfile`) over the pinned stock
`bugsink/bugsink`, adding boto3 and the R2 storage backend below. A merge to `main` touching this
directory redeploys it, and upgrading Bugsink is a tag bump on the `Dockerfile` `FROM` line. A
manual roll is `fly deploy --config apps/bugsink/fly.toml`. `bugsink_conf.py` imports the stock
image's config and overrides only the file object storage, so the rest of Bugsink's env-driven
settings stay upstream's.

The Python here (`r2_storage.py`) sits outside the Bun test graph, so `@vers/bugsink` carries a
`test:adapter` script that runs its pytest suite (moto-mocked S3) under `uv`, and the `python-tests`
workflow runs it on changes to this directory.

## Storage

Event data lives in a dedicated database in the shared Neon project (`DATABASE_URL` secret) — no app
runs its own database and the machine keeps no volume. Uploaded files (sourcemap artifact bundles),
which Bugsink stores in the database by default, go to the Cloudflare R2 bucket `vers-bugsink-files`
via `r2_storage.py` instead, keeping those blobs and their read traffic off Neon. Existing files
move across with `bugsink-manage migrate_to_current_objectstorage`.

## Secrets

| Secret                 | Value                                                      |
| ---------------------- | ---------------------------------------------------------- |
| `SECRET_KEY`           | `openssl rand -base64 50`                                  |
| `DATABASE_URL`         | the Neon `bugsink` database, pooled connection URL         |
| `CREATE_SUPERUSER`     | `email:password` — first boot only, unset after            |
| `R2_ENDPOINT_URL`      | `https://<cloudflare-account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET`            | `vers-bugsink-files`                                       |
| `R2_ACCESS_KEY_ID`     | R2 S3 access key id                                        |
| `R2_SECRET_ACCESS_KEY` | R2 S3 secret access key                                    |

The R2 credentials also live on the `bugsink-r2` item in the `vers` 1Password vault. Unset the four
`R2_*` secrets and Bugsink falls back to storing files in the database.

## Housekeeping

The `.github/workflows/bugsink-vacuum.yml` workflow runs `bugsink-manage vacuum_files` monthly (and
on manual dispatch) to drop unused sourcemap `File`/`Chunk` rows before they accumulate in the
shared Neon database. It enqueues a snappea background task, so the run returns immediately.

## API tokens

Tokens are minted in the Bugsink UI or with `bugsink-manage create_auth_token` over
`fly ssh console`. Two exist: the MCP server's token, stored as `mcp-token` on the `bugsink` item in
the `vers` 1Password vault (read by `.mcp.json` at connect time), and CI's source-map upload token,
stored as the `SENTRY_AUTH_TOKEN` GitHub secret beside the `VITE_SENTRY_DSN` GitHub variable.
