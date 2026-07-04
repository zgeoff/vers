#!/usr/bin/env bash
# Concatenates a shared and a project partial into a generated AGENTS.md.
# Usage: build-agents-md.sh <shared-partial> <project-partial> <output>
set -euo pipefail

shared="$1"
project="$2"
out="$3"

{
  echo '<!-- Generated file — do not edit. Edit agents/project.md here, or agents/shared.md in zgeoff/tools. -->'
  echo
  cat "$shared"
  echo
  cat "$project"
} > "$out"
