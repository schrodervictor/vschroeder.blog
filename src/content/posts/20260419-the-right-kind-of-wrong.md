---
title: The right kind of wrong
description: >
  Running systemd inside a container is considered bad practice. I did it
  anyway, on purpose, for end-to-end testing. Here's why blindly following
  best practices can be worse than thoughtfully breaking them.
pubDate: 2026-04-19
author: Victor Schroeder
tags:
  - testing
  - software-engineering
  - containers
  - systemd
  - good practices
---

There is a rule that most Linux engineers know: don't run systemd inside
a container. Containers are supposed to run a single process. Systemd is
an init system that wants to be PID 1 and manage everything. Putting it
in a container violates the container model, creates weird edge cases
with cgroups and signal handling, and generally produces something that
is neither a proper container nor a proper VM. The internet is full of
articles explaining why this is a bad idea, and they're right.

I did it anyway.

## The problem

I built a tool called [stenogit](https://github.com/schrodervictor/stenogit)
that auto-commits changes in directories to git, driven by systemd units.
The tool registers templated services and timers, writes config files to
`/etc/stenogit/`, creates systemd drop-ins for schedule overrides, and
manages the lifecycle with `systemctl enable`, `systemctl disable`,
`daemon-reload`. The whole thing is deeply integrated with systemd.

The unit tests were solid. 76 of them, running in a container with
mocked systemctl, mocked inotifywait, temp directories for config paths.
Every function tested in isolation. Every code path covered.

But up to that point, I had never actually seen the tool work end-to-end. I
had never watched a real systemd timer fire a real oneshot service that runs a
real `git commit`. I had never verified that the `EnvironmentFile` directive
actually loads my conf file, that `%i` actually expands to the instance name,
that `daemon-reload` actually picks up a drop-in override.

The unit tests verify the code. They don't verify the integration with
the target system the code was designed to run on.

## The alternatives

The conventional ways to test systemd integration are:

**A virtual machine.** Spin up a Vagrant box or an EC2 instance, install
the tool, run the tests, tear it down. This works, but it's slow.
Booting a VM can take minutes. The feedback loop kills the
development flow. And if you want this in CI, you need nested
virtualization or a cloud provider willing to give you bare metal.

**Test on your own machine.** Install the tool, run it, see what
happens. This is what most people actually do, and it's fine... until it
isn't. A bug in the cleanup path leaves orphaned timers firing every 15
minutes. A typo in a unit file enables a service you didn't intend. You
find out when your journal fills up or when you notice a mysterious
`systemctl list-timers` entry a week later.

**Don't test the integration.** Trust that the unit files are correct
because you've read them carefully, and rely on the unit tests for
everything else. This is a pragmatic choice given that systemd itself
is robust and heavily tested. However, it doesn't catch wrong assumptions
I may have in my head about how it works. This kind of "operation bias"
infects unit tests and can only be caught by proper end-to-end tests.

I was about to install this on my own laptop, and "trust me, the systemd
wiring is correct" is exactly the kind of confidence that leads to 3am
debugging sessions.

None of these gave me what I wanted: fast, hermetic, repeatable
verification that the tool actually works when systemd is in the picture.

## The little abomination

So I did the wrong thing. I ran systemd as PID 1 inside a podman
container, so I could test it manually:

```shell
$ podman container run \
    --rm \
    --tty \
    --interactive \
    --tmpfs /tmp \
    --tmpfs /run \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:ro \
    --volume "$PWD":/src \
    --stop-signal SIGRTMIN+3 \
    stenogit-test:latest /lib/systemd/systemd
```

There's a lot going on in that command. Systemd uses cgroups to organize
and track the processes it manages, so it needs read access to the cgroup
filesystem at `/sys/fs/cgroup`. The `tmpfs` mounts on `/tmp` and `/run`
give systemd the scratch space it expects to be writable. The stop signal
is set to `SIGRTMIN+3` because systemd, as PID 1, ignores the default
`SIGTERM` that containers normally use to shut down. `SIGRTMIN+3` is what
systemd interprets as a clean shutdown request (the equivalent of
`systemctl poweroff`).

The source tree is volume-mounted at `/src` so the tests can install
the tool from inside the container.

The output given by the command above resembles the one you get when turning
on a machine without a desktop environment installed, dropping you to a
login prompt. Only good vibes:

```shell
$ podman container run \
    --rm \
    --tty \
    --interactive \
    --tmpfs /tmp \
    --tmpfs /run \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:ro \
    --volume "$PWD":/src \
    --stop-signal SIGRTMIN+3 \
    stenogit-test:latest /lib/systemd/systemd
systemd 257.9-1~deb13u1 running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +IMA +IPE +SMACK +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +IPTC +KMOD +LIBCRYPTSETUP +LIBCRYPTSETUP_PLUGINS +LIBFDISK +PCRE2 +PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD +BPF_FRAMEWORK +BTF -XKBCOMMON -UTMP +SYSVINIT +LIBARCHIVE)
Detected virtualization podman.
Detected architecture x86-64.

Welcome to Debian GNU/Linux 13 (trixie)!

Failed to open libbpf, cgroup BPF features disabled: Operation not supported
Queued start job for default target graphical.target.
[  OK  ] Created slice system-getty.slice - Slice /system/getty.
[  OK  ] Created slice system-modprobe.slice - Slice /system/modprobe.
[  OK  ] Created slice user.slice - User and Session Slice.
[  OK  ] Started systemd-ask-password-console.path - Dispatch Password Requests to Console Directory Watch.
[  OK  ] Started systemd-ask-password-wall.path - Forward Password Requests to Wall Directory Watch.
[  OK  ] Reached target paths.target - Path Units.
[  OK  ] Reached target remote-fs.target - Remote File Systems.
[  OK  ] Reached target slices.target - Slice Units.
[  OK  ] Reached target swap.target - Swaps.
[  OK  ] Listening on systemd-creds.socket - Credential Encryption/Decryption.
[  OK  ] Listening on systemd-initctl.socket - initctl Compatibility Named Pipe.
[  OK  ] Listening on systemd-journald-dev-log.socket - Journal Socket (/dev/log).
[  OK  ] Listening on systemd-journald.socket - Journal Sockets.
         Starting systemd-journald.service - Journal Service...
         Starting systemd-remount-fs.service - Remount Root and Kernel File Systems...
         Starting systemd-tmpfiles-setup-dev-early.service - Create Static Device Nodes in /dev gracefully...
[  OK  ] Finished systemd-remount-fs.service - Remount Root and Kernel File Systems.
[  OK  ] Finished systemd-tmpfiles-setup-dev-early.service - Create Static Device Nodes in /dev gracefully.
         Starting systemd-sysusers.service - Create System Users...
[  OK  ] Started systemd-journald.service - Journal Service.
         Starting systemd-journal-flush.service - Flush Journal to Persistent Storage...
[  OK  ] Finished systemd-sysusers.service - Create System Users.
         Starting systemd-tmpfiles-setup-dev.service - Create Static Device Nodes in /dev...
[  OK  ] Finished systemd-journal-flush.service - Flush Journal to Persistent Storage.
[  OK  ] Finished systemd-tmpfiles-setup-dev.service - Create Static Device Nodes in /dev.
[  OK  ] Reached target local-fs-pre.target - Preparation for Local File Systems.
[  OK  ] Reached target local-fs.target - Local File Systems.
         Starting systemd-tmpfiles-setup.service - Create System Files and Directories...
[  OK  ] Finished systemd-tmpfiles-setup.service - Create System Files and Directories.
         Starting ldconfig.service - Rebuild Dynamic Linker Cache...
         Starting systemd-journal-catalog-update.service - Rebuild Journal Catalog...
[  OK  ] Finished systemd-journal-catalog-update.service - Rebuild Journal Catalog.
[  OK  ] Finished ldconfig.service - Rebuild Dynamic Linker Cache.
         Starting systemd-update-done.service - Update is Completed...
[  OK  ] Finished systemd-update-done.service - Update is Completed.
[  OK  ] Reached target sysinit.target - System Initialization.
[  OK  ] Started apt-daily.timer - Daily apt download activities.
[  OK  ] Started apt-daily-upgrade.timer - Daily apt upgrade and clean activities.
[  OK  ] Started dpkg-db-backup.timer - Daily dpkg database backup timer.
[  OK  ] Started systemd-tmpfiles-clean.timer - Daily Cleanup of Temporary Directories.
[  OK  ] Reached target timers.target - Timer Units.
[  OK  ] Listening on systemd-hostnamed.socket - Hostname Service Socket.
[  OK  ] Reached target sockets.target - Socket Units.
[  OK  ] Reached target basic.target - Basic System.
         Starting systemd-user-sessions.service - Permit User Sessions...
[  OK  ] Finished systemd-user-sessions.service - Permit User Sessions.
[  OK  ] Started console-getty.service - Console Getty.
[  OK  ] Reached target getty.target - Login Prompts.
[  OK  ] Reached target multi-user.target - Multi-User System.
[  OK  ] Reached target graphical.target - Graphical Interface.

Debian GNU/Linux 13 d441cda9ebd6 console

d441cda9ebd6 login:
```

And it stays there awaiting the login. I don't know what the default login
details are of a Debian container, but I also don't care. With this container
running I could now run commands against it on another terminal window,
using `podman container exec`:

```shell
$ podman container exec --interactive --tty d441cda9ebd6 /bin/bash
root@d441cda9ebd6:/src#
```

From there, it was very natural to do all the testing I needed. The source
code was mounted and I could create dummy directories, play with timers,
nested directory structures, install, uninstall, delete files, break the
system in many ways that I wouldn't dare do on my own laptop.

## From manual tests to an e2e testing suite

Manual tests are very reassuring, but I don't want to do this all the time,
so let's make the process automated with a new Make target:

```makefile
test-e2e: image
	@CID="$$(\
		podman container run \
			--detach \
			--volume $(CURDIR):/src \
			$(IMAGE) /lib/systemd/systemd \
	)"; \
	cleanup() { \
		podman container kill --signal SIGRTMIN+3 "$$CID" >/dev/null 2>&1; \
		podman container rm "$$CID" >/dev/null 2>&1; \
	}; \
	trap cleanup EXIT; \
	sleep 2; \
	podman exec "$$CID" bash -c " \
		make -C /src build install PREFIX=/usr BUILD_DIR=/tmp/stenogit-build \
		&& systemctl daemon-reload \
		&& bats /src/tests/e2e/ \
	"
```

It turns out Podman supports a simplified version of the command I described
above, as it takes care of mounting the necessary `/sys` directory and creating
the scratch dirs for `/tmp` and `/run`. Also the exit signal is adjusted.

After a two-second settle time (systemd needs a moment to initialize),
the Makefile execs into the container, installs stenogit, reloads the daemon,
and runs the end-to-end test suite. A trap ensures cleanup happens even if the
tests fail.

The tests exercise the full lifecycle. Here is an example:

```bash
@test "add enables a timer that can fire a commit" {
    stenogit add "$name" "$TEST_DIR/tracked" --git-name "E2E" --git-email "e2e@test"

    # Timer should be active.
    systemctl is-active "stenogit@$name.timer"

    # Trigger the oneshot manually instead of waiting.
    systemctl start "stenogit@$name.service"

    # Verify the commit landed.
    run git -C "$TEST_DIR/tracked" log --oneline
    [ "$status" -eq 0 ]
    [ "${#lines[@]}" -ge 1 ]

    # Clean up and verify everything is gone.
    stenogit remove "$name"
    ! systemctl is-active --quiet "stenogit@$name.timer" 2>/dev/null
    [ ! -f "/etc/stenogit/$name.conf" ]
}
```

Real `systemctl`. Real `EnvironmentFile`. Real timer activation. Real
oneshot execution. The watcher test writes a file to disk and waits for
inotifywait to trigger a real commit through the real debounce loop.

Five tests, covering timer mode, schedule drop-ins, watch mode, list,
and remove cleanup. The whole suite runs in under 30 seconds.

## Why "bad practice" needs context

The rule against running systemd in containers exists for good reasons.
In production, a container should be a single-purpose process with
a clean lifecycle. Systemd in a container fights the orchestrator, makes
health checks unreliable, complicates logging, and obscures failure
modes. If you're running systemd in a Kubernetes pod, something has gone
wrong architecturally.

But that's the production context. My context is different:

- The container is **ephemeral**. It starts, runs tests, and is
  destroyed. Its lifespan is 30 seconds.
- It runs **locally** or in CI. Nobody deploys it. It doesn't serve
  traffic. It doesn't store data.
- The purpose is **verification**, not operation. I need systemd to be
  there so I can test the integration, not because I want it to manage
  production workloads.
- The alternative is **worse**. Testing blindly on my own machine, or
  not testing the integration at all, carries more risk than a 30-second
  container that exists only to be thrown away.

The "bad practice" label describes a solution in the wrong context. In
the right context, it's just a tool.

## Critical thinking about rules

The software industry is full of rules that sound absolute but aren't.
"Don't use global variables." "Don't run as root." "Don't use regex to
parse HTML." "Don't put logic in the database." Each of these is good
advice in the general case. Each of them has legitimate exceptions that
experienced engineers recognize.

The problem with treating rules as absolute is that it shuts down
analysis. If someone says "you can't run systemd in a container" and
you stop there, you miss the next question: **why not, and does that
reason apply here?**

The why matters more than the rule. If the reason is "it complicates
production operations," and you're not in production, the rule doesn't
apply. If the reason is "it creates security risks," and your container
exists for 30 seconds in a test pipeline, the risk is virtually zero.

This tendency to dogmatize rules is prominent in the software industry,
and I felt it in this particular case. Because running systemd in a
container is so widely discouraged, it is surprisingly hard to find
practical information about how to do it, even though it is absolutely
possible.

Even AI coding assistants told me that what I was trying to
do was "not possible" because it required systemd to run as PID 1.
The rule had been repeated so often that it collapsed from "you
probably shouldn't" into "you can't".

This isn't a license to ignore best practices. It's an argument for
understanding them well enough to know when they don't apply.

## The payoff

After running `make test-e2e` and seeing five green tests, I installed
stenogit on my laptop with confidence. Not the "I read the code
carefully and I think it's right" kind. The "I watched it work against
real systemd in a simulated system" kind.

When the watcher service crashed with exit code 127 a few minutes later
(inotifywait wasn't installed), I diagnosed it in under a minute. I knew
the wiring was correct because I had seen it work. The problem had to be
environmental. And it was.

That certainty cost me one Makefile target and one test file. No VMs, no
cloud instances, no manual testing, no hoping for the best. Just a
little "abomination" in a container that lives for 30 seconds and
gives me the exact kind of certainty I need.

Sometimes the wrong thing, done deliberately, in a contained way, for
a specific reason, is the right thing.
