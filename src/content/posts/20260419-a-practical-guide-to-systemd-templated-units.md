---
title: A practical guide to systemd templated units
description: >
  Templated units, drop-in overrides, user vs system scope, and a
  debugging workflow for when things go wrong. Everything I learned
  while building a tool that needed many instances of the same service.
pubDate: 2026-04-19
author: Victor Schroeder
tags:
  - systemd
  - linux
  - debugging
  - homelab
---

If you're not familiar with systemd: it's the process manager that runs
on virtually every modern Linux distribution. It starts services at boot,
restarts them if they crash, manages their logs, and handles scheduling.
You configure it by writing **unit files**, small INI-style text files
that describe what to run, how, and when.

I recently built a small tool that tracks arbitrary directories by
auto-committing changes to git. The tool needs to run as a systemd
service, but each tracked directory is its own independent instance with
its own config, schedule, and trigger mode. That means I can't just
write one unit file. I need many copies of the same service, each
parameterized differently.

Systemd has a mechanism for exactly this: **templated units**. The
documentation is thorough but dense, so here's a practical walkthrough
based on what I actually needed.

## The core idea: one file, many instances

A unit file with `@` in the name is a template. You never start the
template directly, but **instances** of it. The part after `@` is the
instance name `<service-name>@<instance-name>.service`. For example:

```
foo@.service        ← template of "foo" (note the "empty" name)
foo@alice.service   ← "alice" instance of "foo" service
foo@bob.service     ← "bob" instance of "foo" service
```

Inside the template file, `%i` expands to the instance name. There are
other specifiers too:

| Specifier | Expands to                               |
|-----------|------------------------------------------|
| `%i`      | Instance name (`alice`)                  |
| `%I`      | Same, but unescaped (handles `/` etc.)   |
| `%h`      | User's home directory                    |
| `%U`      | User ID                                  |
| `%n`      | Full unit name (`foo@alice.service`)     |

## A real example

Here's a simplified version of the service I ended up with. It uses
`Type=oneshot`, which means it runs a command once and exits (as
opposed to a long-running daemon). I decided to call my service
`stenogit` (more about it in the
[next post](/posts/20260419-stenogit-a-silent-stenographer-for-your-filesystem/)).
It runs a commit script for a specific tracked directory:

```ini
[Unit]
Description=Auto-commit for %i

[Service]
Type=oneshot
EnvironmentFile=/etc/stenogit/%i.conf
Environment=INSTANCE=%i
ExecStart=/usr/local/bin/stenogit-commit
```

The `EnvironmentFile` directive loads a per-instance config file. For
an instance called `nginx`, systemd reads `/etc/stenogit/nginx.conf`. The
script itself is generic and all the per-instance data comes through
environment variables.

Starting it:

```shell
$ sudo systemctl start stenogit@nginx.service
```

That's it. One file on disk, as many instances as you need.

## Timers, also templated

Systemd has its own built-in scheduling mechanism called **timers**.
They serve the same purpose as cron jobs, but are tightly integrated
with the rest of systemd: they can depend on other units, their logs
go to the journal, and they show up in `systemctl` like any other unit.

A timer is just another unit file, and it can be templated too. A
templated timer can schedule any instance of the corresponding service:

```ini
[Unit]
Description=Schedule for %i

[Timer]
OnBootSec=1min
OnUnitActiveSec=15min
Unit=stenogit@%i.service

[Install]
WantedBy=timers.target
```

The `WantedBy=timers.target` line in the `[Install]` section tells
systemd to start this timer automatically at boot, alongside all other
active timers.

Enable and start a timer for a specific instance:

```shell
$ sudo systemctl enable --now stenogit@nginx.timer
```

The `enable` command registers the timer so it starts on every boot.
The `--now` flag also starts it immediately, so you don't have to
reboot to see it working. Now `stenogit@nginx.service` runs every
15 minutes, starting 1 minute after boot. A different instance with a
different name gets its own independent timer.

## Per-instance overrides with drop-ins

The template defines defaults, but what if one instance needs a different
schedule? Systemd's drop-in mechanism lets you override specific
directives per instance without touching the template.

Create a directory named after the specific instance's unit, with a
`.d` suffix:

```shell
$ sudo mkdir -p /etc/systemd/system/stenogit@nginx.timer.d
```

Then write a conf file inside it:

```ini
[Timer]
OnUnitActiveSec=
OnUnitActiveSec=5min
```

The empty `OnUnitActiveSec=` on the first line is important. For
list-typed directives, systemd appends by default. The empty value
clears the inherited list before setting the new one. Without it, you'd
end up with two timers firing at different intervals.

After editing drop-ins, always reload. Systemd caches unit file
contents in memory, so it won't see your changes until you tell it to
re-read from disk:

```shell
$ sudo systemctl daemon-reload
```

You can verify the final merged configuration with:

```shell
$ systemctl cat stenogit@nginx.timer
```

This shows the template plus all drop-ins applied on top.

## User scope vs system scope

Systemd units come in two flavors:

- **System units** live in `/etc/systemd/system/` (or
  `/usr/lib/systemd/system/` for packages). They run as root, start at
  boot, and are managed with `sudo systemctl`.
- **User units** live in `~/.config/systemd/user/` (or
  `$PREFIX/lib/systemd/user/` for packages). They run as your user, are
  managed with `systemctl --user`, and by default **stop when you log
  out**.

That last point is the one that catches people. If you set up a
user-scoped timer to run every 15 minutes and then close your SSH
session, the timer stops. To keep user units running after logout:

```shell
$ loginctl enable-linger $USER
```

For unattended automation (the kind that should survive reboots and run
whether or not anyone is logged in), system scope is usually the right
choice. User scope is appropriate for personal tooling: dotfile
watchers, desktop notification services, development helpers.

The unit files themselves are almost identical between scopes. The main
difference is in paths. A user unit can use `%h` (home directory) to
find per-user config:

```ini
EnvironmentFile=%h/.config/stenogit/%i.conf
```

A system unit uses absolute paths:

```ini
EnvironmentFile=/etc/stenogit/%i.conf
```

## Debugging: a step-by-step workflow

When something goes wrong with a systemd service, there's a consistent
sequence that gets you to the answer quickly.

### Step 1: check the unit status

```shell
$ systemctl status stenogit@nginx.service
```

This shows whether the service is running, its exit code, and the last
few log lines. The exit code is often enough to diagnose the problem:

| Code | Meaning                                                   |
|------|-----------------------------------------------------------|
| 0    | Success                                                   |
| 1    | Generic script failure                                    |
| 126  | Permission denied (file exists but is not executable)     |
| 127  | Command not found                                         |
| 203  | systemd could not exec the ExecStart binary               |
| 217  | The User= specified in the unit does not exist            |

For timers, check when they last fired and when they'll fire next:

```shell
$ systemctl list-timers --all
```

### Step 2: read the journal

Systemd captures everything your service writes to stdout and stderr
in a centralized log called the **journal**. You query it with
`journalctl`:

```shell
$ journalctl [--user] -u stenogit@nginx.service --no-pager
```

Use `--user` for user-scoped units. This shows all output from the
service plus systemd lifecycle messages (start, stop, exit code). Use `-f`
to follow in real time, or `-n 50` for the last 50 lines.

### Step 3: check the environment

```shell
$ systemctl [--user] show-environment
```

This shows the `PATH` and other variables that systemd passes to services.
A common gotcha: systemd's `PATH` is minimal. A command that works in your
interactive shell might not be found by a service because `/usr/local/bin`
or `~/.local/bin` isn't in systemd's `PATH`.

I ran into exactly this. My service was crashing with exit code 127. The
script was at `/usr/local/bin/stenogit-watch`, and it internally called
`inotifywait`, which wasn't installed at all. The journal just said
`status=127/n/a`. Checking `which inotifywait` in the shell confirmed the
missing binary.

### Step 4: test outside systemd

Run the same command with the same environment:

```shell
$ source /etc/stenogit/nginx.conf
$ INSTANCE=nginx stenogit-commit
```

If this works in your shell but fails under systemd, the difference is
environment. Check `PATH`, `HOME`, and any other variables your script
depends on.

### Step 5: trigger manually

For timer-backed services, you don't have to wait for the next tick:

```shell
$ sudo systemctl start stenogit@nginx.service
```

This fires the oneshot immediately so you can check the journal right
away.

### Quick reference

| What              | Command                                   |
|-------------------|-------------------------------------------|
| Status            | `systemctl status <unit>`                 |
| Logs              | `journalctl -u <unit> -f`                 |
| Timer schedule    | `systemctl list-timers`                   |
| Environment       | `systemctl show-environment`              |
| Resolved unit     | `systemctl cat <unit>`                    |
| Manual trigger    | `systemctl start <unit>`                  |
| Reload after edit | `systemctl daemon-reload`                 |

Add `--user` for user-scope units, `sudo` for system-scope units.

## Putting it all together

The pattern for multi-instance systemd services is:

1. Write a templated unit file with `%i` for the instance name
2. Use `EnvironmentFile` to load per-instance configuration
3. Keep all logic in the script; the unit file is pure wiring
4. Use drop-ins for per-instance schedule overrides
5. Choose system scope for unattended services, user scope for personal
   tooling

The templating mechanism is one of the better-designed parts of systemd.
One file, many instances, each independently configurable, each with its
own journal, its own status, its own lifecycle. No custom orchestration
daemon, no process manager, no wrapper scripts. Just systemd doing what
it already does well.

In [part two](/posts/20260419-stenogit-a-silent-stenographer-for-your-filesystem/)
I'll show the tool I built on top of this pattern: a directory tracker
that auto-commits changes to git, fully unattended.
