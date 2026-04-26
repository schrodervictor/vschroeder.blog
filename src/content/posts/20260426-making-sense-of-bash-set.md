---
title: Making sense of "set", the powerful Bash built-in
description: >
  A field guide to the many flags and options behind `set`, with a
  reference table and the combinations you'll actually use in real
  shell scripts.
pubDate: 2026-04-26
author: Victor Schroeder
tags:
  - bash
  - shell
  - scripting
  - reference
---

I write a lot of shell scripts. There comes a time in the life of every
script when it has to decide what kind of "`set`" it identifies as.
But whether it ends up as a `set -euo pipefail` or something else,
I still have to pause for a second to remember what each flag is doing.
Bash's `set` built-in has roughly thirty flags and options, and the
documentation is scattered across `help set`, `man bash`, and the GNU Bash
reference manual. None of them read particularly well.

This post is an attempt to put it all in a single place: more as a quick
reference for myself than a complete documentation of every flag, with
a handful of combinations that actually show up in real scripts, so that
I can quickly pick the ones I need. Hopefully some of you will also find
it helpful.

## The basics

Before the tables, three mechanics worth knowing up front, because they
are honestly confusing.

**Enabling vs. disabling.** Counterintuitively, `-` (minus) *enables* an option
and `+` (plus) *disables* it. The minus sign comes from the way shell flags
have always been written, but the mental model is "`-` turns something on".

```shell
$ set -e     # enable errexit
$ set +e     # disable errexit
```

**Short form vs. long form.** Most options have a single-letter short
form (like `-e`) and a long-form name used with `-o` (like `-o errexit`).
They're equivalent. A few options exist only in long form.

```shell
$ set -e
$ set -o errexit    # same thing
```

**Querying current state.** `set -o` with no argument lists every option
and its current state. Useful when a script is behaving oddly and you
want to see what's on.

```shell
$ set -o
allexport       off
braceexpand     on
errexit         on
...
```

Also worth knowing: `set --` with no arguments clears the positional
parameters (`$1`, `$2`, ...), and `set -- foo bar baz` sets them. This
is a separate feature from the options, but it lives on the same
built-in.

## The (not really) complete reference

There are roughly thirty options behind `set`, but in practice they
fall into three buckets: the flags you'll actually reach for when
writing scripts, the ones that govern interactive shell behavior, and
the ones that are either relics or so rarely toggled that you can skip
them on a first read.

Why "not really" complete? Look at the results of the commands below
(`wc -l` counts the number of lines of the given input):

```shell
$ sh -c 'set -o' | wc -l
20

$ bash -c 'set -o' | wc -l
27

$ zsh -c 'set -o' | wc -l
185
```

Switch shells and the surface area explodes, easily going from 20 to
almost 200 flags in `zsh` (most of `zsh`'s behavior is exposed as a
shell option through this same built-in). POSIX `sh` keeps things
minimal, and non-Bourne shells like `fish` go in their own direction
entirely. If you've ever wondered why `set -o` feels different on
different machines, that's why.

The tables that follow are the Bash view of `set`, with a column
indicating which options are also available in POSIX `sh` (based on
`sh -c 'set -o'` on a typical Debian/Ubuntu system, where `/bin/sh`
is `dash`).

### Most useful in scripts

These are the flags that show up at the top of real scripts and inside
common patterns like loading `.env` files, debugging, and trap
handling.

<!-- .reference-table styles defined in src/styles/terminal.css -->
<div class="reference-table">

| Short | Long (`-o`) | POSIX sh | What it does                                                            |
|-------|-------------|----------|-------------------------------------------------------------------------|
| `-a`  | `allexport` | yes      | Variable assignments are automatically exported.                        |
| `-C`  | `noclobber` | yes      | Prevent `>` from overwriting existing files. Use `>\|` to force.        |
| `-e`  | `errexit`   | yes      | Exit immediately if a command returns non-zero.                         |
| `-E`  | `errtrace`  | no       | `ERR` trap is inherited by functions, subshells, and `$(...)`.          |
| `-f`  | `noglob`    | yes      | Disable globbing (pathname expansion).                                  |
| `-n`  | `noexec`    | yes      | Read commands but don't execute them. Useful for syntax checks.         |
| `-T`  | `functrace` | no       | DEBUG and RETURN traps inherited by functions, subshells, and `$(...)`. |
| `-u`  | `nounset`   | yes      | Treat references to unset variables as an error.                        |
| `-v`  | `verbose`   | yes      | Print each shell input line as it is read.                              |
| `-x`  | `xtrace`    | yes      | Print every command (after expansion) before executing it.              |
|       | `pipefail`  | yes      | A pipeline returns the exit status of its rightmost *failing* command.  |

</div>

### Interactive flags

Defaults that govern how the shell behaves at the prompt. Most of these
are automatically set/unset in interactive sessions. You might tweak
them in your `.bashrc`, but they rarely show up inside a script.

<div class="reference-table">

| Short | Long (`-o`)            | POSIX sh | What it does                                                      |
|-------|------------------------|----------|-------------------------------------------------------------------|
| `-b`  | `notify`               | yes      | Report finished background jobs immediately, not at prompt.       |
| `-H`  | `histexpand`           | no       | Enable `!`-style history expansion. On by default (interactive).  |
| `-m`  | `monitor`              | yes      | Job control. On by default in interactive shells.                 |
|       | `emacs`                | yes      | Emacs-style command line editing. On by default (interactive).    |
|       | `history`              | no       | Enable command history. On by default (interactive).              |
|       | `ignoreeof`            | yes      | Don't exit on EOF (`Ctrl-D`). Requires `exit` to leave.           |
|       | `interactive-comments` | no       | Treat `#` as a line comment in interactive shells. On by default. |
|       | `vi`                   | yes      | Vi-style command line editing.                                    |

</div>

### Legacy or rarely toggled

Bourne shell relics, security niches, or defaults you'd basically never
touch. Worth recognizing when you see them in old scripts, but not
worth memorizing.

<div class="reference-table">

| Short | Long (`-o`)   | POSIX sh | What it does                                                                   |
|-------|---------------|----------|--------------------------------------------------------------------------------|
| `-B`  | `braceexpand` | no       | Enable brace expansion (`{a,b,c}`). On by default.                             |
| `-h`  | `hashall`     | no       | Enable caching the path of commands once looked up. On by default.             |
| `-k`  | `keyword`     | no       | Treats `VAR=value` as command environment anywhere on the line. Mostly unused. |
| `-P`  | `physical`    | no       | `cd` and `pwd` follow the physical directory tree, not symlinks.               |
| `-p`  | `privileged`  | yes      | Don't read `$ENV`/`$BASH_ENV`, don't inherit functions from env.               |
| `-t`  | `onecmd`      | no       | Exit after reading and executing one command.                                  |
|       | `nolog`       | yes      | Don't save function definitions to the history file.                           |
|       | `posix`       | no       | Switch to POSIX-compliant behavior where Bash differs.                         |

</div>

## Most useful flags and combinations

### Bash strict mode: `set -euo pipefail`

This is the combo everyone copy-pastes at the top of their scripts, and
for good reason. It fixes three of Bash's most painful defaults in one
line.

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e` (`errexit`): exit on any failed command, instead of happily continuing.
- `-u` (`nounset`): error out on typos like `$usre_id` instead of
  silently expanding to an empty string.
- `-o pipefail`: make `cmd1 | cmd2 | cmd3` fail if *any* of them fail,
  not just the last one. Well, kind of, this one is a bit more complicated.

Blindly applying the combination of `-e` and `-o pipefail` can lead to
unexpected results and long debugging sessions.

For example, without `pipefail`, a pipeline like `grep missing file.txt | wc -l`
will happily return `0` because `wc` succeeded, even though `grep` never found
anything. Internally, `grep` is _failing_ with an exit code `1`. With `pipefail`
the result of the whole pipeline will be `1` and with `-e` the script will
break. Do you really want the script to fail entirely, or were you just
counting words? Choose wisely.

Also worth noting: `errexit` is aware of where it is invoked. When
the command is "consumed" by an `if`, for example, the script won't
exit. It's up to the logic inside the `if` built-in to decide what to
do next.

Some people add `-E` (`errtrace`) and `-T` (`functrace`) to the mix,
so that `trap '...' ERR` and `trap '...' DEBUG` fire inside functions
too. If you're using traps for cleanup or logging, `set -Eeuo pipefail`
is the fuller version.

### Trace mode: `set -x`

When a script is misbehaving and you want to see what it's actually
doing, turn on `xtrace`:

```shell
$ set -x
$ name=world
+ name=world
$ echo "hello, $name"
+ echo 'hello, world'
hello, world
$ set +x
+ set +x
```

Every command is printed with a leading `+` before execution, with
all variables expanded. This is the single most useful debugging
technique in shell scripting, and it composes with strict mode:

```shell
$ set -euxo pipefail
```

For a more readable trace, customize `PS4`. It's the prefix `xtrace`
prints before each line:

```shell
$ export PS4='+ ${BASH_SOURCE}:${LINENO}: '
$ set -x
```

Now every traced line shows its source file and line number, which
is invaluable in scripts that source other scripts. For example:

```shell
$ cat ./greet.sh
name=world
echo "hello, $name"
$ source ./greet.sh
+ ./greet.sh:1: name=world
+ ./greet.sh:2: echo 'hello, world'
hello, world
```

### Syntax check without executing: `set -n`

`noexec` reads the script and parses it but doesn't run anything. It
catches syntax errors without side effects:

```shell
$ bash -n my-script.sh
```

This is almost always used as a flag to `bash` rather than inside a
script. Useful in CI to sanity-check scripts before shipping.

### Environment export: `set -a` ... `set +a`

A surprisingly common pattern when loading config files. Inside the
block, every variable assignment is automatically exported to child
processes:

```shell
$ set -a
$ source .env
$ set +a
```

Without `-a`, you'd have to either write `export` before each line
in `.env` or manually re-export each variable afterward. With `-a`,
a plain `KEY=value` file becomes an environment file. This is how
many Docker and systemd toolchains end up loading `.env` files in
shell wrappers.

### Glob-safe iteration: `set -f`

If you're iterating over a list of patterns or strings that might
contain `*`, `?`, or `[`, disable globbing temporarily:

```bash
set -f
for pattern in "${patterns[@]}"; do
    echo "Processing: $pattern"
done
set +f
```

Without `-f`, a pattern like `*.log` would expand to matching files
instead of staying as a literal string. Niche, but it has saved me
from a couple of bugs when processing user-supplied arguments.

### Positional parameter tricks: `set --`

Not an option flag, but worth mentioning because it's easy to forget
`set` can do this. To reset positional parameters from the output of
a command:

```shell
# double quotes around $(...) omitted on purpose, otherwise
# the output of `date` would count as a single argument
$ set -- $(date +'%Y %m %d')
$ echo "Year: $1, Month: $2, Day: $3"
```

Or to clear them entirely:

```shell
$ set --
```

Combined with `getopts` or manual argument parsing, this is how many
scripts rewrite their own `$@` after pulling off the first few
arguments.

### Atomic file creation: `set -C`

`noclobber` makes the `>` redirection use the `O_EXCL` flag, turning
"create the file, but only if it doesn't already exist" into a single
**atomic syscall**. The classic use case is the shell lock-file pattern,
where two instances of a script must not run at the same time:

```shell
LOCK=/var/run/myscript.lock

if ! (set -C; echo "$$" > "$LOCK") 2>/dev/null; then
    echo "Already running (PID $(cat "$LOCK"))" >&2
    exit 1
fi
trap 'rm -f "$LOCK"' EXIT
```

If two or more instances race to create the lock, exactly one will
win; the rest fail cleanly. Without `noclobber`, both processes would
overwrite the file and the lock would do nothing. A check-then-write
approach isn't safe either, since another process could create the
file between the check and the write. Atomicity is what makes the
pattern work.

`set -C` is also a sensible default in scripts that generate output
files where silently overwriting an existing one would be destructive.
It's possible to force the overwrite, when you really mean to, with `>|`:

```shell
$ echo hello >| existing.txt
```

As a bonus, the same flag works in your interactive `.bashrc` and
saves you from the occasional typo'd redirect that would otherwise
destroy a file you meant to keep.

## A few tricky things

**`set -e` is weaker than it looks.** It only fires for commands whose
exit status isn't being inspected. So `cmd || true`, `if cmd; then ...`,
`cmd && other`, and commands inside pipelines (without `pipefail`) all
silently swallow failures. This is a feature, not a bug, but it means
`-e` isn't the bulletproof guard many people expect.

**`set -u` and unset arrays.** Under `-u`, referring to an empty array
element like `${arr[0]}` errors out if the array is empty. Use
`${arr[0]-}` (with the `-` default) to guard against it.

**Options inside functions.** `set -e`, `-u`, `-x`, and friends are
shell-wide, not function-local. If you want to toggle an option only
inside a function, save and restore it manually or use a subshell
`( set -x; ...; )`.

**`shopt` is a different built-in.** Bash also has `shopt` (shell
options), which controls a separate set of toggles like `nullglob`,
`extglob`, and `globstar`. If you've been looking for `set -o globstar`
and can't find it, that's why. `shopt -s globstar` is where it lives.

## Closing thoughts

`set` is one of those built-ins that looks arcane until you sit down
and list out what each flag actually does. Most of the time you'll
only touch four or five of them, but it's worth knowing the rest
exist so you can recognize them when you see an unfamiliar script
header.

If there's one takeaway, it's this: don't blindly copy-paste
`set -euo pipefail` on top of every script. Longer scripts are likely to
benefit from these options, but check carefully whether that's what you
actually want.

The defaults Bash ships with are optimized for interactive use, not
reliable scripts. Take a minute to learn what each option actually
does, and flip the right switches at the top of your file
intentionally.
