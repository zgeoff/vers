#!/usr/bin/env bash
# repo-sync delivers this file from zgeoff/tools; edit it there.
#
# Runs a command inside a cgroup capped at <MiB> of memory with no swap, then
# prints the cgroup's peak anonymous memory and its OOM kills. Fails when the
# command fails or the kernel OOM-killed a process in the cgroup.
# Usage: run-memory-capped.sh <MiB> <command> [args...]
#        run-memory-capped.sh --modes
# MEMORY_CAP_MODE picks a mode; unset, the first mode --modes prints wins.
set -euo pipefail

modes=(systemd-sudo systemd-user cgroupfs)

usage() {
  echo 'usage: run-memory-capped.sh <MiB> <command> [args...]' >&2
  echo '       run-memory-capped.sh --modes' >&2
  exit 2
}

has_systemd() {
  [ -d /run/systemd/system ] && command -v systemd-run > /dev/null
}

probe_mode() {
  case "$1" in
    systemd-sudo) has_systemd && sudo -n true 2> /dev/null ;;
    systemd-user)
      has_systemd || return 1
      local group
      group=$(systemctl --user show --property=ControlGroup --value 2> /dev/null) || return 1
      # A user manager without the memory controller delegated to it runs a
      # scope that ignores MemoryMax.
      [ -n "$group" ] && grep -qw memory "/sys/fs/cgroup$group/cgroup.controllers" 2> /dev/null
      ;;
    cgroupfs) find_cgroupfs_parent > /dev/null ;;
    *) return 1 ;;
  esac
}

# cgroup v2 lets a cgroup other than the root hold processes or enable a
# controller for its children, never both, so the capped cgroup is a sibling
# of this process's own one.
find_cgroupfs_parent() {
  [ -f /sys/fs/cgroup/cgroup.controllers ] || return 1
  local own parent
  own=$(sed -n 's/^0:://p' /proc/self/cgroup)
  parent=$(dirname "$own")
  parent="/sys/fs/cgroup${parent%/}"
  [ -w "$parent" ] && [ -w "$parent/cgroup.procs" ] || return 1
  grep -qw memory "$parent/cgroup.subtree_control" || return 1
  echo "$parent"
}

to_mib() {
  if [[ "$1" =~ ^[0-9]+$ ]]; then
    echo "$(($1 / 1048576)) MiB"
  else
    echo "$1"
  fi
}

forward_signal() {
  if [ -n "$command_pid" ]; then
    kill -s "$1" "$command_pid" 2> /dev/null || true
  else
    pending_signal=$1
  fi
}

# Runs the command in the cgroup that holds this shell, as <user> when one is
# given, and sets status to the exit status this script ends with.
run_and_report() {
  local cgroup=$1 user=$2 mode=$3
  shift 3

  # The OOM killer picks among every process in the cgroup, and a kill of this
  # shell or its sampler loses the report; a privileged shell takes itself out
  # of the choice, and the command takes the default back.
  local protected=false
  if echo -1000 2> /dev/null > /proc/self/oom_score_adj; then
    protected=true
  fi

  # memory.peak counts the page cache, which the kernel takes back under the
  # cap; the anonymous memory, sampled every 200 ms, is what it cannot. Under
  # the cap a fork can fail, so the sampler runs on builtins alone, with a
  # timed read of a pipe that never gets data in place of sleep.
  local sample_fd sampler
  exec {sample_fd}< <(
    set +e
    peak=0
    trap 'echo "$peak"; exit 0' TERM
    exec {tick_fd}<> <(:)
    echo ready
    while :; do
      while read -r key value; do
        if [ "$key" = anon ] && [ "$value" -gt "$peak" ]; then
          peak=$value
        fi
      done < "$cgroup/memory.stat"
      read -rt 0.2 -u "$tick_fd"
    done
  )
  sampler=$!
  read -r _ <&"$sample_fd"

  # A signal to this shell goes on to the command as the same signal, so the
  # report and the cleanup still run once the command ends. The traps go in
  # before the command starts, and a signal that comes first waits for it.
  command_pid=''
  pending_signal=''
  local signal
  for signal in TERM INT HUP; do
    # shellcheck disable=SC2064 # each trap holds its own signal's name
    trap "forward_signal $signal" "$signal"
  done
  (
    if [ "$protected" = true ]; then
      echo 0 > /proc/self/oom_score_adj
    fi
    if [ -n "$user" ]; then
      exec setpriv --reuid="$user" --regid="$(id -g "$user")" --init-groups -- "$@"
    fi
    exec "$@"
  ) <&0 &
  command_pid=$!
  if [ -n "$pending_signal" ]; then
    kill -s "$pending_signal" "$command_pid" 2> /dev/null || true
  fi
  # bash prints the whole source of a job that a signal kills on its own
  # stderr, which only a background job's wait can silence. The <&0 keeps
  # stdin, which bash points at /dev/null for a background job. A wait that
  # a signal cuts short returns 128 plus the signal, and bash can reap the
  # command while the trap runs, so the loop waits until the command is gone
  # and a last wait reads the exit status that bash keeps for it.
  while kill -0 "$command_pid" 2> /dev/null; do
    wait "$command_pid" 2> /dev/null || true
  done
  status=0
  wait "$command_pid" 2> /dev/null || status=$?
  trap - TERM INT HUP

  kill "$sampler"
  local anon_peak
  read -r anon_peak <&"$sample_fd" || anon_peak=unknown
  exec {sample_fd}<&-
  wait "$sampler" 2> /dev/null || true

  local swap='absent' peak='absent' oom_kills
  if [ -f "$cgroup/memory.swap.max" ]; then
    swap=$(cat "$cgroup/memory.swap.max")
  fi
  # memory.peak needs Linux 5.19.
  if [ -f "$cgroup/memory.peak" ]; then
    peak=$(cat "$cgroup/memory.peak")
  fi
  oom_kills=$(sed -n 's/^oom_kill //p' "$cgroup/memory.events")
  {
    echo "run-memory-capped: $mode, memory.max $(to_mib "$(cat "$cgroup/memory.max")"), memory.swap.max $(to_mib "$swap")"
    echo "run-memory-capped: peak anon memory $(to_mib "$anon_peak"), sampled every 200 ms; memory.peak $(to_mib "$peak")"
    echo "run-memory-capped: OOM kills $oom_kills"
  } >&2
  if [ "$oom_kills" != 0 ]; then
    local prefix=''
    if [ "${GITHUB_ACTIONS:-}" = true ]; then
      prefix='::error::'
    fi
    echo "${prefix}run-memory-capped: the command went over its memory cap, and the kernel OOM-killed a process" >&2
    status=1
  fi
}

# Moves this shell back to its own cgroup, then removes the capped one, which
# the kernel refuses while it holds a process.
remove_cgroup() {
  echo "$$" > "$own/cgroup.procs"
  if ! rmdir "$cgroup" 2> /dev/null; then
    echo "run-memory-capped: $cgroup still holds a process the command left running, so it stays" >&2
  fi
}

if [ "${1:-}" = --modes ]; then
  for mode in "${modes[@]}"; do
    if probe_mode "$mode"; then
      echo "$mode"
    fi
  done
  exit 0
fi

# The second half of a systemd mode, which systemd-run starts inside the scope.
if [ "${1:-}" = --inside ]; then
  user=$2
  mode=$3
  shift 3
  run_and_report "/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)" "$user" "$mode" "$@"
  exit "$status"
fi

if [ "$#" -lt 2 ] || ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
  usage
fi
mib=$1
shift

mode=${MEMORY_CAP_MODE:-}
if [ -z "$mode" ]; then
  mode=none
  for candidate in "${modes[@]}"; do
    if probe_mode "$candidate"; then
      mode=$candidate
      break
    fi
  done
elif [ "$mode" != none ] && ! probe_mode "$mode"; then
  echo "run-memory-capped: MEMORY_CAP_MODE is $mode, which this host does not support; it supports: $(bash "$0" --modes | tr '\n' ' ')none" >&2
  exit 2
fi

self=$(readlink -f "$0")
case "$mode" in
  # sudo keeps the environment, and PATH, which its secure_path resets;
  # OOMPolicy=continue keeps the scope, and its report, alive when the kernel
  # kills the command.
  systemd-sudo)
    exec sudo --preserve-env env "PATH=$PATH" systemd-run --scope --quiet --collect \
      --unit="run-memory-capped-$$" \
      -p MemoryMax="${mib}M" -p MemorySwapMax=0 -p OOMPolicy=continue \
      -- bash "$self" --inside "$(id -un)" "$mode" "$@"
    ;;
  systemd-user)
    exec systemd-run --user --scope --quiet --collect \
      --unit="run-memory-capped-$$" \
      -p MemoryMax="${mib}M" -p MemorySwapMax=0 -p OOMPolicy=continue \
      -- bash "$self" --inside '' "$mode" "$@"
    ;;
  cgroupfs)
    own="/sys/fs/cgroup$(sed -n 's/^0:://p' /proc/self/cgroup)"
    cgroup="$(find_cgroupfs_parent)/run-memory-capped-$$"
    mkdir "$cgroup"
    trap remove_cgroup EXIT
    echo "$((mib * 1048576))" > "$cgroup/memory.max"
    if [ -f "$cgroup/memory.swap.max" ]; then
      echo 0 > "$cgroup/memory.swap.max"
    fi
    echo "$$" > "$cgroup/cgroup.procs"
    run_and_report "$cgroup" '' "$mode" "$@"
    exit "$status"
    ;;
  none)
    echo 'run-memory-capped: this host has no systemd scope and no writable cgroup v2 parent for a memory cap, so the command runs uncapped' >&2
    exec "$@"
    ;;
  *)
    echo "run-memory-capped: MEMORY_CAP_MODE is $mode; use one of: ${modes[*]} none" >&2
    exit 2
    ;;
esac
