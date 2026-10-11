#!/usr/bin/env bash
# Checks each README against its line limit and each docs/ file against its cap, then runs
# check-prose.sh over the same files. A README over its limit fails the run; a README over its
# target and a docs/ file over its cap print a warning and never fail it.
# Usage (from the repo root): check-length.sh [--package <readme>]...
# A README is a package README when it sits beside a package.json that is not private, or when
# --package names it. Any other README is the plain repo README at the root, or a sub-package
# README below it.
set -uo pipefail

usage() {
  echo "usage: check-length.sh [--package <readme>]..." >&2
  exit 2
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
marked=$'\n'

while [ "$#" -gt 0 ]; do
  case $1 in
    --package)
      [ "$#" -ge 2 ] || usage
      [ -f "$2" ] || {
        echo "check-length: --package names $2, which does not exist" >&2
        exit 2
      }
      marked+=${2#./}$'\n'
      shift 2
      ;;
    *) usage ;;
  esac
done

# Lists tracked and untracked files, so a new doc is checked before it is staged. A file deleted
# from the working tree stays in the index until the deletion is staged, so it is dropped here.
list_files() {
  git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$@" | sort -u | while IFS= read -r file; do
    [ -f "$file" ] && printf '%s\n' "$file"
  done
}

count_lines() {
  awk 'END { print NR }' "$1"
}

is_public_package() {
  local manifest=$1/package.json
  [ -f "$manifest" ] && ! grep -Eq '"private"[[:space:]]*:[[:space:]]*true' "$manifest"
}

# Prints the README's target, limit and kind.
pick_readme_kind() {
  local readme=$1 dir
  dir=$(dirname "$readme")

  if [[ $marked == *$'\n'"$readme"$'\n'* ]] || is_public_package "$dir"; then
    echo '120 130 package'
  elif [ "$dir" = . ]; then
    echo '50 60 plain repo'
  else
    echo '60 70 sub-package'
  fi
}

fail=0
prose_paths=()

# docs/README.md is the docs index, so the docs cap governs it, not a README limit.
while IFS= read -r readme; do
  prose_paths+=("$readme")
  read -r target limit name <<<"$(pick_readme_kind "$readme")"
  lines=$(count_lines "$readme")

  if [ "$lines" -gt "$limit" ]; then
    fail=1
    echo "$readme: $lines lines, over the $name README limit of $limit (target $target)"
  elif [ "$lines" -gt "$target" ]; then
    echo "$readme: $lines lines, over the $name README target of $target (limit $limit; warning)"
  else
    echo "$readme: $lines lines ($name README; target $target, limit $limit)"
  fi
done < <(list_files ':(glob)**/README.md' ':(exclude,glob)docs/**' ':(exclude,glob).claude/**')

docs=$(list_files ':(glob)docs/**/*.md')

if [ -n "$docs" ]; then
  prose_paths+=(':(glob)docs/**/*.md')
fi

while IFS= read -r doc; do
  [ -n "$doc" ] || continue
  cap=250
  case /$doc in */runbooks/*) cap=300 ;; esac
  lines=$(count_lines "$doc")

  if [ "$lines" -gt "$cap" ]; then
    echo "$doc: $lines lines, over the docs cap of $cap (warning: cut points, then split at a code boundary)"
  fi
done <<<"$docs"

echo

if [ "${#prose_paths[@]}" -gt 0 ]; then
  bash "$script_dir/check-prose.sh" "${prose_paths[@]}" || fail=1
fi

exit "$fail"
