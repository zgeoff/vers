# app-bugsink secrets

The `vers-bugsink` Fly app reads these secrets. The [README](./README.md) covers what the app is and
how it stores files.

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
