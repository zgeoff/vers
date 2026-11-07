#!/usr/bin/env bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
root=$(dirname "$scripts_dir")

# knip gives jiti the working directory as a file path, and jiti looks for tsconfig.json from its
# parent, so in a worktree inside another checkout knip reads that checkout's tsconfig. Starting
# knip one real folder down makes the search start at the repo root.
cd "$scripts_dir"
exec "$root/node_modules/.bin/knip" --directory "$root" "$@"
