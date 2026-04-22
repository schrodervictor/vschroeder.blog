---
title: 'Securing coding agents: from banned tools to the Confused Deputy'
description: >
  Building a secure sandbox for an AI coding agent is a fascinating game of cat
  and mouse. From shell injection to OS-level sandboxing, here is why blocking
  tools isn't enough, and why treating agent output as untrusted code is the
  only way forward.
pubDate: 2026-04-23
author: Victor Schroeder
tags:
  - ai
  - security
  - software-engineering
---

As autonomous AI coding agents become more capable, the desire to give them
unrestricted access to our local environments grows. It's incredibly convenient
to let an agent read your codebase, write files, and run terminal commands to
test its own work.

But this convenience comes with a massive security footprint. If you give a
Turing-complete text generator the ability to write bytes to disk and invoke a
runtime, it can theoretically do anything that runtime can do. So, how do you
contain it?

Securing an AI agent isn't a single switch you flip; it's a fascinating journey
through escalating vulnerabilities. Let's walk through the levels of
containment, why each one eventually fails, and how we can finally achieve a
secure equilibrium.

## Level 1: Banning the Shell (The Naive Approach)

The first and most obvious step to securing an agent is blocking its ability to
run arbitrary shell commands. If you are using an extensible agent harness like
Pi, this means disabling its native `bash` tool.

You could simply launch the agent with a restricted allowlist
(`pi --tools read,edit,write`), or you can write an extension that intercepts
the tool execution and provides a hard-block failsafe:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash") {
      return {
        block: true,
        reason: "Security policy: The bash tool is strictly disabled.",
      };
    }
  });
}
```

Problem solved, right? The agent can no longer run `rm -rf /` or exfiltrate your
environment variables. It can only modify text files.

Well, not really.

A coding agent that can't compile code, run tests, or execute task runners
is severely crippled. We _need_ it to execute things, just safely.

## Level 2: The Task Runner Trap

To safely restore execution capabilities, you might write a custom tool that
acts as a wrapper around your project's task runner, like Make. Instead of
passing an arbitrary bash command, the LLM passes a structured JSON object with
targets and variables.

In your Node.js backend, you invoke this securely using `child_process.spawn()`:

```typescript
const args = [...params.flags, ...params.targets];
const env = { ...process.env, ...params.variables };

// spawn bypasses the shell entirely, neutralizing standard shell injections
child_process.spawn("make", args, { env });
```

Because `spawn` does not use an intermediate shell (like `child_process.exec`
does), a payload like `DOCKER_TAG="foo .; rm -rf /; echo "` passed via
environment variables is just treated as a literal string.

But here is where Make bites you. **Make variables are pure textual macros**,
and Make uses `/bin/sh` to execute every recipe line.

If your `Makefile` looks like this:

```make
build-image:
	docker build --tag $(DOCKER_TAG) .
```

Make blindly expands `$(DOCKER_TAG)` _before_ handing it to the shell. The
sandbox is instantly broken. The `rm -rf /` executes anyway.

### The Fix: Escaping Make

Because you can't safely escape variables from the outside without knowing the
exact quoting context inside the `Makefile`, you have three choices:

1. **Strict Regex Safelisting:** The custom tool strictly validates `DOCKER_TAG`
   against `^[a-zA-Z0-9_-]+$`. If the AI wants to pass spaces or special
   characters, it gets blocked.
2. **Move to `just`:** A modern runner like
   [`just`](https://github.com/casey/just) supports true positional arguments.
   When you call `spawn("just", ["build", "foo; rm -rf /"])`, `just` securely
   parameterizes it.
3. **Move to `Taskfile`:** Uses structured YAML and Go templates, eliminating
   textual macro vulnerabilities entirely. It can even output its schema as
   JSON, allowing your agent harness to automatically generate strictly-typed
   native tools for every task in your project.

## Level 3: The Perimeter Breach (Self-Modification)

So, the agent can only edit files and safely run `just` targets. It's perfectly
secure, right?

Except for one glaring issue: the agent still has the `write` and `edit` tools.

If the agent can edit _any_ file, it can simply modify its own configuration
files (like `.pi/settings.json`) to re-enable the `bash` tool. It could edit
your `.github/workflows/` to exfiltrate secrets the next time you push to
GitHub. Or it could poison the very `justfile` we just secured.

To counter this, we have to build **Path-Based Protections**. We intercept the
agent's file-writing capabilities at the tool level, enforcing strict
blocklists:

```typescript
const PROTECTED = [".pi/**", "**/.github/**", "justfile", ".env*"];

pi.on("tool_call", async (event) => {
  if (event.toolName === "write" || event.toolName === "edit") {
    const isProtected = checkAgainstPatterns(event.input.path, PROTECTED);
    if (isProtected) {
      return {
        block: true,
        reason: "Path protected to prevent execution hijacking.",
      };
    }
  }
});
```

This acts as a solid application-level firewall.

## Level 4: Kernel-Level Containment (The Ephemeral OS Sandbox)

Application-level firewalls (like the Node.js interceptors above) are fragile.
If we want true security, we need to enforce these restrictions at the Operating
System level.

While running the agent inside an ephemeral Docker container is a common
approach, dealing with "Docker-in-Docker" (when your project itself uses
containers) is notoriously painful.

A far more elegant approach is leveraging native OS sandboxing tools like
`bwrap` (Bubblewrap) on Linux or `sandbox-exec` on macOS. These tools allow us
to create highly restricted execution namespaces for the agent's processes
_without_ the overhead of a full virtual machine.

By using a wrapper (like Anthropic's `@anthropic-ai/sandbox-runtime`), we can
configure an OS-level straitjacket:

```json
{
  "network": {
    "allowedDomains": ["github.com", "registry.npmjs.org"],
    "deniedDomains": ["*"]
  },
  "filesystem": {
    "denyRead": ["~/.ssh", "~/.aws", "~/.gnupg"],
    "allowWrite": [".", "/tmp"],
    "denyWrite": [".env", ".pi/"]
  }
}
```

Now, even if the agent manages to gain arbitrary code execution, it literally
cannot open network sockets to exfiltrate data to unknown domains, and the Linux
kernel itself will block it from reading your SSH keys or writing to protected
directories.

## Level 5: The Confused Deputy

We have finally arrived at the perfect sandbox. The agent cannot run arbitrary
shell commands. It cannot inject malicious task runner arguments. Its file I/O
and network access are restricted by the OS kernel. It is a completely contained
environment.

Is it secure? **No.**

Because eventually, the agent finishes its work. It successfully writes a shiny
new feature into your `src/` directory. And what do you do? You, the highly
privileged human developer, run `npm start` to test it. Or you commit it to
`main`, and your CI/CD pipeline runs it.

This is the classic **Confused Deputy** problem. The agent doesn't need to break
out of its sandbox. It just needs to poison the well. It writes a subtle
backdoor or a malicious script, knowing that _you_ will unknowingly execute it
on its behalf, outside of the sandbox.

## The Paradigm Shift: Untrusted Code

This progression reveals the fundamental truth about autonomous coding agents:
**preventing an agent from causing harm cannot be solved purely by isolating the
agent itself.**

The agent is a text generator. If you give it a `write` tool, it generates
files. If those files are later executed by _anything_ -- Pi, Make, NPM, Docker,
or you -- the agent has achieved code execution.

Treating the agent's output as anything other than untrusted code is a critical
security vulnerability. The only mathematically sound way to maintain security
is to sever the autonomous execution loop entirely:

1. **The Quarantine Branch:** The agent must never commit to your primary
   working branch. It works in a dedicated branch (e.g., `agent/feature-x`).
2. **The Diff Boundary:** The only safe way to transfer code out of the agent's
   environment is via a text diff. A patch file is just text; it cannot harm
   your computer until it is executed.
3. **Zero-Trust Review:** You must review the agent's diff exactly as you would
   review a Pull Request from a completely unknown, potentially malicious
   stranger on the internet. You are not just reviewing for code quality; you
   are reviewing for anomalies, unexpected dependency additions, and poisoned
   build scripts.
4. **Ephemeral Testing:** If you need to run the agent's code before merging it
   to verify it works, do so in a disposable VM or container, not directly on
   your host machine.

You can build the most impenetrable, kernel-level sandbox in the world, but the
moment you take the code out of the sandbox and run it blindly, the sandbox
ceases to exist.
