---
title: Book a meeting with your agent
description: >
  AI agents produce code fast, but they also make architectural decisions
  that slip past review. When things break, you're reverse-engineering
  an alien system. The fix might be surprisingly low-tech: a weekly
  meeting with your agent.
pubDate: 2026-04-22
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - code-review
  - practices
---

Here's something that doesn't get enough attention: AI agents don't
just produce code. They also make small architectural decisions all
the time.

Every time an agent writes a function, it decides where that function
lives, what it depends on, how it communicates with the rest of the
system. It chooses data structures, error handling strategies, module
boundaries. These are not trivial implementation details. They are
design decisions, and they accumulate, for the good or for the bad.

With "auto-accept" edits turned on (which is increasingly the norm,
because the output is genuinely good most of the time), many of these
decisions go unnoticed during a coding session. The code compiles,
tests are passing, the feature works. Ship it.

Until something breaks in production.

And even the most senior engineers may find themselves
reverse-engineering an alien system. Code written by a machine, with
architectural choices that look foreign. Not necessarily wrong, but
unfamiliar. Nobody in the team made those decisions. Nobody remembers
why things are structured the way they are. Because nobody was paying
attention when the decisions were made.

When that happens, it's a symptom that something went wrong much
earlier.

## The departed colleague problem

There's a useful parallel here. Think of a colleague who leaves the
company after writing a significant chunk of code, but in this example
there was no proper handover, no documentation, very few code
comments explaining the reasoning behind non-obvious choices. The
inherited code kinda works, but nobody remaining understands *why*
it works the way it does.

Every team has dealt with this at some point. It's painful but
manageable, because the departed colleague went through an onboarding
phase at "human" pace. They started with simpler tasks. They were
closely reviewed by peers until they earned trust. The code they left
behind, while under-documented, was at least shaped by the norms
and conventions of the team.

AI agents skip all of that.

They are onboarded on a codebase in seconds and start producing
massive amounts of code in minutes. There is no gradual trust-building
phase. There is no period of close review followed by a relaxation of
scrutiny. The agent goes from "just arrived" to "shipping features" in
a single prompt.

What is worse, after the session is finished, that whole context is
gone or will degrade with "context compaction" over time, even if
the sessions are reused. You have potentially a "departed colleague"
every single time.

Yet, for some reason, AI agents are enjoying a remarkable degree of
trust from peers and pressure from management to ship their output
faster. Understanding is not important. Relax the review. The machine
knows better.

## Documentation helps, but it's not enough

Part of this can be addressed with better prompting discipline. You
can instruct your agent to document its decisions as it goes. Inline
code comments are genuinely valuable here, not just for the humans
reading the code, but also for future agent sessions. As I mentioned,
agents tend to forget things aggressively when the context window
runs short and the conversation gets compacted. Good comments help
them re-orient.

But documentation doesn't solve the root problem, which is _ownership_.

When a human engineer writes code, they carry a mental model of the
system. They know what they changed, why they changed it, what they
considered and rejected. That mental model persists between sessions,
evolves over time, and informs future decisions. The engineer *owns*
the code in a meaningful sense. It is certainly impossible to
write down all the internally considered details and learnings, but
it stays with the human engineer.

When an agent writes code, that mental model exists only during the
session. Once the context is gone, the model is gone. The next session
starts from scratch, re-reading files, rebuilding context, potentially
making different choices than the previous session would have made.
Nobody owns the decisions. They just happened.

Code review helps, but how thorough can a review really be when
thousands of lines of varying quality are being produced at staggering
speed? You can't keep up. And if you can't keep up, you start
rubber-stamping. And if you're rubber-stamping, you're not reviewing.

## A wild proposal

So here's a suggestion that might sound odd: book a meeting with your
agent.

I mean a real meeting. With the directly involved team members.
Ideally with a voice interface so the conversation flows naturally. Do
it weekly, maybe more often if the pace of AI-generated changes is
high.

Take the most important PRs of the week and go through them with the
agent (or agents) that produced the code. Not a quick skim. A proper
scrutiny session. Ask the agent to explain its decisions:

- Why did you structure this module this way?
- What alternatives did you consider?
- How does this interact with the existing authentication flow?
- What happens when this service is unavailable?
- Why did you introduce this new dependency?

Make the team question the choices. Challenge the assumptions. Treat
it exactly like you would treat an architecture review with a junior
engineer who shipped a lot of code very fast.

Record the meeting. Extract action points. Feed the conclusions back
into the next coding session as context.

## Preserving the context

The tricky part is that by the time you sit down for the review, the
original conversation context may be long gone. The agent's context
window was compacted, the session ended, the memory of *why* it made
those decisions evaporated. You're now asking an agent to explain code
it has no memory of writing. It becomes AI-generated guesswork.

That's why the review session should happen with the same context
that was used to develop the feature. There are a few ways to make
this work in practice.

Most agent tools support session resumption natively. Claude Code, for
example, has `--resume` and checkpoint mechanisms that let you pick up
where you left off. Pi has context trees. Any of these work well if the
operator is organized enough to keep track of which session produced
which PR.

But sessions get compacted and context degrades over time. A more
robust approach is to version the agent's own configuration and
memory files. Tools like Claude Code store project context in a
`.claude` directory. If you track that directory with automatic
versioning (using something like
[stenogit](https://github.com/schrodervictor/stenogit), for example),
you get a timestamped history of exactly what the agent knew and was
being instructed to do at any point in time.

When it's time to review a specific PR, you can restore the agent
context from that point:

```shell
# Checkout the .claude directory as it was during the PR
$ git worktree add .claude-pr123 <commit-hash> -- .claude

# Start the agent with that context
$ cd /path/to/your/project
$ CLAUDE_CONFIG_DIR=.claude-pr123 claude --resume
```

Now you're talking to an agent that has the same instructions, memory,
and project context it had when the code was written. The conversation
can pick up from where it stopped, even if the original session was
compacted weeks ago.

Combined with `--resume` and the same working directory, the
reconstruction is complete. The agent gets back exactly where it left
off: same conversation history, same project context, same memory. As
far as the agent is concerned, it never left.

## Why this works

This sounds like overhead. It definitely is. But it's time well spent:
it shares knowledge, builds a sense of ownership in the team, and
consolidates coding practices for future AI-assisted sessions.

The alternative is discovering architectural drift three months later
during an incident, when the cost of understanding and fixing is
orders of magnitude higher. A weekly one-hour session where the team
collectively builds a mental model of what the agent produced is
cheap compared to a _post-mortem_ where nobody can explain why the
system behaved the way it did.

It also changes the team's relationship with the AI-generated code.
Instead of treating it as a black box that appeared from a PR, the
team engages with it, questions it, and either endorses the decisions
or corrects them. The ownership transfers from "the agent wrote it" to
"the team reviewed it and agreed." That's a fundamentally different
posture.

And the agents are actually good at this kind of conversation. They
can explain their reasoning, walk through trade-offs, and respond to
different "what if" scenarios. They're often better at explaining code
than writing documentation about it, because the explanation is
interactive and the reviewer can push back in real time.

## The real issue

None of this should be necessary if we were reviewing AI code with the
same rigor we apply (or should apply) to human code. But the speed
differential makes traditional review impractical at scale. The volume
is too high. The pace is too fast. Something has to give.

What shouldn't give is understanding. If the team members don't
understand the code they ship, they don't own it. Without ownership,
they can't really maintain it. If code is not properly maintained,
the next incident becomes some sort of archaeology expedition.

Book the meeting and talk to your agents. It's maybe the least glamorous
practice in the AI-assisted engineering toolkit, but it might become a
very important one.
