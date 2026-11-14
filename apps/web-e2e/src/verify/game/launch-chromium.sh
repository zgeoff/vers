#!/bin/sh
# The browser driver's Chromium, with a DevTools port added, so the game driver can attach to the
# same browser: read the worker's state, cut the network and open a second device beside the page.
# Playwright talks to the browser over the pipe it passes in "$@", which exec keeps open.
set -eu

if [ ! -x "${VERS_VERIFY_CHROMIUM:-}" ]; then
  echo "launch-chromium: no Chromium at VERS_VERIFY_CHROMIUM='${VERS_VERIFY_CHROMIUM:-}'; run: bun run verify:install-browser" >&2
  exit 1
fi

# Chrome puts its process-singleton socket under TMPDIR, and refuses to start when that path runs
# past the 108-byte socket limit, as a long session TMPDIR does
export TMPDIR=/tmp

exec "$VERS_VERIFY_CHROMIUM" --remote-debugging-address=127.0.0.1 --remote-debugging-port="$VERS_VERIFY_DEVTOOLS_PORT" "$@"
