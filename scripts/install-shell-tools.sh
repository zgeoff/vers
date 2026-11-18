#!/usr/bin/env bash
# Installs the pinned shfmt and shellcheck into $RUNNER_TEMP/shell-tools and
# adds that folder to $GITHUB_PATH, checking each download against its
# published hash, so what CI checks does not move with the runner image. The
# versions and hashes come from SHFMT_VERSION, SHFMT_SHA256,
# SHELLCHECK_VERSION and SHELLCHECK_SHA256.
set -euo pipefail

bin="$RUNNER_TEMP/shell-tools"
mkdir -p "$bin"

curl -fsSL -o "$bin/shfmt" \
  "https://github.com/mvdan/sh/releases/download/$SHFMT_VERSION/shfmt_${SHFMT_VERSION}_linux_amd64"
echo "$SHFMT_SHA256  $bin/shfmt" | sha256sum -c -
chmod +x "$bin/shfmt"

archive="shellcheck-$SHELLCHECK_VERSION.linux.x86_64.tar.gz"
curl -fsSL -o "$RUNNER_TEMP/$archive" \
  "https://github.com/koalaman/shellcheck/releases/download/$SHELLCHECK_VERSION/$archive"
echo "$SHELLCHECK_SHA256  $RUNNER_TEMP/$archive" | sha256sum -c -
tar -xzf "$RUNNER_TEMP/$archive" -C "$RUNNER_TEMP"
mv "$RUNNER_TEMP/shellcheck-$SHELLCHECK_VERSION/shellcheck" "$bin/shellcheck"

echo "$bin" >> "$GITHUB_PATH"
