---
title: "Stenogit: a silent stenographer for your filesystem"
description: >
  A tool that watches directories and auto-commits changes to git, fully
  unattended. How it works, the design decisions behind it, and what I
  learned building it with systemd templated units.
pubDate: 2026-04-19
author: Victor Schroeder
tags:
  - linux
  - git
  - systemd
  - bash
  - open-source
---

Very often I use git to track changes in important directories. I've
been doing that for years at places like `/etc`, `/usr`, `~/.config`
and others. It is very interesting to see what happens every time you
install a new `.deb` file. It also saved my work many times, especially
because I knew exactly how to _undo_ stuff.

One issue, however, is that I never really automated this to the full
extent. Yes, I have been using `apt` hooks, but I wanted something similar
for the other directories I keep track of.

The goal was simple: pick an arbitrary directory, have every change
automatically committed to git, no human intervention required. Not a
backup tool, not a sync service, just a silent record of what changed
and when. A stenographer for the filesystem.

The use case is straightforward. You have `/etc/nginx` on a server. An
engineer edits a config file at 3am during an incident. A week later,
nobody remembers what was changed. With automatic git tracking, you run
`git log` and see exactly what happened: which files, what diff, what
timestamp.

The same applies to dotfiles, application configs, or any directory
where changes matter but nobody wants to think about committing them.

The tool now exists and is called [stenogit](https://github.com/schrodervictor/stenogit).
This is the story of how it came to be.

## How it works

Three shell scripts, wired together by systemd:

**`stenogit-commit`** is the core. It stages all changes in a directory,
counts the staged files, expands a message template with placeholders,
and commits. If nothing changed, it exits cleanly. It is fully
parameterized using environment variables (`DIR`, `INSTANCE`,
`MESSAGE_TEMPLATE`), so it's trivially testable and completely agnostic
about how it gets invoked.

**`stenogit-watch`** is the real-time trigger. It runs `inotifywait` on
the directory, debounces bursts of events (you don't want a commit for
every intermediate write during a `tar` extraction), then calls
`stenogit-commit`. There's also a max-wait ceiling (default 60 seconds)
that forces a commit even under sustained churn, so busy directories
don't postpone commits indefinitely.

**`stenogit`** is the CLI that hides systemd from end users. You run
`stenogit add`, it initializes the git repo, writes the config file,
and enables the appropriate systemd unit. You never have to think about
unit files, drop-ins, or `daemon-reload`.

## Two triggers, one commit script

Each tracked directory can use either a timer or a watcher:

```shell
# Timer: commit every 10 minutes
$ sudo stenogit add nginx /etc/nginx --schedule 10min

# Watcher: commit on every change (with debouncing)
$ stenogit add --user dotfiles ~/dotfiles --watch
```

Both triggers call the same `stenogit-commit` script. The timer fires
on a schedule via a systemd timer; the watcher fires when `inotifywait`
detects filesystem events. The commit logic doesn't know or care which
one invoked it.

This separation turned out to be one of the best design decisions in
the project. The commit script is a pure function of its environment:
give it a directory and it will commit whatever changed. Testing it
doesn't require inotify or systemd. Testing the debounce loop doesn't
require a real git repo. Each piece is independently verifiable.

## System scope by default

An early version used systemd user units (`systemctl --user`). This
works for personal directories, but the primary use case (tracking
system config like `/etc/nginx`) is machine-wide. User units have two
problems for this:

1. They stop when you log out, unless you enable lingering. For
   unattended operation, that's an extra thing to remember.
2. Two users tracking the same directory would create two independent
   git repos, which makes no sense for system-wide configuration.

Every comparable tool in the Linux ecosystem (cron, logrotate,
etckeeper, fail2ban) runs as a system service. So stenogit follows the
same convention: system scope by default, `--user` as an opt-in for
personal directories.

```shell
# System scope (default, requires root)
$ sudo stenogit add nginx /etc/nginx

# User scope (no root needed)
$ stenogit add --user notes ~/notes --watch
```

## Three layers of configuration

Each instance has three kinds of configuration, each stored where its
consumer naturally looks:

**A conf file** (`/etc/stenogit/nginx.conf` for system scope,
`~/.config/stenogit/nginx.conf` for user scope) holds runtime
parameters:

```shell
DIR=/etc/nginx
MESSAGE_TEMPLATE='auto: {date}'
DEBOUNCE=5
MAX_WAIT=60
```

The systemd unit loads it via `EnvironmentFile`. The script reads env
vars. Editing the conf file takes effect on the next trigger, no
`daemon-reload` needed.

**Git identity** (`user.name`, `user.email`) is set in the tracked
repo's `.git/config` at `add` time. It belongs to the repo, not to the
runtime environment. If the directory moves, the identity travels with
it.

**Timer schedule** overrides use systemd drop-ins. The template has a
default schedule (15 minutes); a custom schedule gets its own drop-in
file that clears the inherited value and sets the new one. This is pure
systemd, managed by the CLI but editable with `systemctl edit` if you
prefer.

The three scripts work together, each one taking care of its own
domain. The CLI (`stenogit add`) writes all three in a single command,
so users don't need to know about the layering.

## Message template placeholders

The commit message is templated with a few placeholders:

- `{date}`: ISO-8601 timestamp
- `{count}`: number of staged files
- `{host}`: hostname
- `{name}`: instance name

For example, when the unit is created with:

```shell
$ sudo stenogit add nginx /etc/nginx \
    --message 'auto: {name} {date} ({count} files)'
```

It will produce commit messages as follows:

```
auto: nginx 2026-04-17T14:30:00+02:00 (3 files)
```

The expansion is simple Bash parameter substitution. No dependencies, no
template engine, just `${result//\{date\}/$(date -Iseconds)}`.

## The debounce loop

The watcher's debounce logic deserves a mention because it handles a
subtle problem. When you save a file, the editor may generate multiple
filesystem events: a write, a rename, a chmod. Extracting a tarball
generates hundreds. Without debouncing, each event would trigger a
separate commit.

The debounce loop works like this: when the first event arrives, start
a timer. Each subsequent event resets the timer. When the timer expires
(silence), commit. This produces clean, consistent snapshots.

But there's a catch. A directory with sustained churn (continuous
builds, log rotation) may never go silent. The debounce timer keeps
resetting, and commits are postponed indefinitely.

The solution is a max-wait ceiling. On the first event, a second clock
starts and never resets. If it expires before the debounce timer, the
commit fires anyway. Quiet directories behave exactly as before (the
debounce timer expires first). Busy directories get commits at most
every `MAX_WAIT` seconds.

```
DEBOUNCE=5      # wait for 5 seconds of silence
MAX_WAIT=60     # but never wait more than 60 seconds total
```

## Testing without systemd

The scripts are structured so that bats (Bash Automated Testing System)
can source them and call individual functions directly:

```bash
#!/usr/bin/env bash

sg_stage_all() { git -C "$1" add -A || return 1; }
sg_has_staged_changes() { ! git -C "$1" diff --cached --quiet; }
# ... more functions ...

sg_main() {
    # orchestrates the above
}

# Only run main when executed, not when sourced by tests
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    set -euo pipefail
    sg_main "$@"
fi
```

The test suite mocks systemctl by overriding wrapper functions, mocks
inotifywait with PATH-level shims, and redirects all config paths to
temp directories. No real systemd, no real filesystem pollution, no
root required.

76 unit tests cover the commit script, debounce loop (including the
max-wait ceiling), inotifywait integration (`.git` exclusion, nested
directories), and the CLI (both system and user scope). A separate
end-to-end suite runs inside a podman container with systemd as PID 1,
exercising the full lifecycle against real systemd units.

## Installing and using it

```shell
$ git clone https://github.com/schrodervictor/stenogit
$ cd stenogit
$ make build
$ sudo make install
```

Then track a directory:

```shell
# System scope with a timer
$ sudo stenogit add nginx /etc/nginx --schedule 10min

# User scope with inotify
$ stenogit add --user dotfiles ~/dotfiles --watch --debounce 10

# List everything
$ stenogit list
nginx       system
dotfiles    user

# Stop tracking
$ sudo stenogit remove nginx
```

Dependencies: `bash` (>= 4), `git`, `inotify-tools` (for `--watch`
mode), `systemd`. The CLI checks for `inotifywait` at `add --watch`
time and fails with a clear message if it's missing.

## What I learned

Building this tool reinforced a few things:

**Systemd is good at what it does.** Templated units, drop-ins,
lifecycle management, journal integration. All the features I needed
were already there. The scripts contain logic; the unit files contain
pure wiring. No custom process management, no PID files, no restart
logic.

**The scope choice matters.** Starting with user units felt natural
(no root needed, quick iteration) but was wrong for the primary use
case. System scope is the conventional default for sysadmin automation,
and fighting that convention creates friction everywhere.

**Debounce is not enough.** A calm-down window works for bursty
directories, but sustained churn needs a ceiling. The dual-clock
approach (debounce + max-wait) handles both without too much additional
complexity.

**Shell scripts are fine.** The entire tool is bash. No compiled
language, no runtime dependency beyond what's already on every Linux
system. The functions are small, testable, and the bats test suite
catches regressions effectively. For a tool that runs `git add -A` and
`git commit`, bash is the right level of abstraction.

Stenogit is licensed through MIT. Feel free to give it a try and let
me know how it went. I put a lot of effort into making sure it doesn't do anything
destructive, but of course, do your own research and use it at
your own risk. Pull requests and suggestions are always welcome!

The source code can be found on GitHub: [stenogit](https://github.com/schrodervictor/stenogit).

The [first part](/posts/20260419-a-practical-guide-to-systemd-templated-units/)
of this series covers the systemd concepts (templated units, drop-ins,
debugging) in more detail, independent of stenogit.
