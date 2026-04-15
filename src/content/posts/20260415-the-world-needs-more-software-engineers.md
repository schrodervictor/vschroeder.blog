---
title: The world needs more Software Engineers, not fewer
description: >
  The dominant narrative says AI will eliminate programming jobs. A more
  interesting perspective, borrowed from a recent O'Reilly article, argues
  the opposite: AI makes the craft more technical, not less, and the
  "two computers" problem is just getting started.
pubDate: 2026-04-15
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - career
  - economy
---

If you spend any time in tech circles these days, you'll hear two dominant
narratives about the future of software engineering. The first is the
breathless FOMO: ship faster, adopt everything, rewrite your stack around
agents, or you'll be left behind. The second is the doomer counterpoint:
the machines are coming for your job, coding is a solved problem, pivot to
something else while you still can.

Both are exhausting ...and probably wrong.

I recently came across an
[O'Reilly Radar article](https://www.oreilly.com/radar/the-world-needs-more-software-engineers/)
that offered a refreshing third perspective. Instead of predicting doom or
salvation, it makes a simple structural argument: AI doesn't make software
engineering easier. It makes it harder. Now the market is starting to
notice this.

## The "Two Computers" problem

The most useful framing in the article is what Phillip Carter calls "the
two computers" analogy. For decades, software engineers have been
programming exactly one kind of machine: a deterministic one. You write
code, the code runs, and the same input produces the same output. Bugs
exist, but they're reproducible and the mental model is clean.

AI introduces a "second computer": a probabilistic one. Same input, but
possibly different outputs. No guarantees of correctness. No stack traces
in the traditional sense. You can't unit test a language model the way you
unit test a parser or a compiler.

The interesting part is that these two machines don't live in separate
worlds. They have to talk to each other. Modern applications are now
hybrid systems where deterministic code calls probabilistic models, and
probabilistic models trigger deterministic tools. The boundary between
them is where most of the engineering work now happens.

## The trillion-dollar question

Deciding where that boundary goes is what the article calls "the
trillion-dollar question". It's not a vague philosophical problem, it's a
concrete technical decision that engineers have to make every single day.

Should loan processing be handled by an LLM? Probably not. It needs to be
consistent, auditable, and defensible in court. A deterministic system,
even a rigid one, is the right tool. Should a company's internal HR
chatbot use an LLM? Probably yes. The questions are fuzzy, the answers
are contextual, and nobody gets sued if the bot suggests the wrong
cafeteria menu.

But most cases aren't that clear. Most cases sit somewhere in the middle,
and the decision about which computer should handle which workload has
consequences that cascade through the entire system:

- **Security**: a probabilistic component is an attack surface of a
  completely different nature. Prompt injection, context leakage, indirect
  data exfiltration through tool use. None of these exist in a purely
  deterministic system.
- **Explainability**: when something goes wrong, can you explain why?
  "The model decided to" is not an incident post-mortem. Not when money,
  health, safety, or even lives are on the line.
- **Legal and regulatory**: some jurisdictions are starting to require
  that automated decisions affecting individuals be explainable and
  contestable. "It's an LLM response" doesn't satisfy that requirement.
- **Compliance**: audit trails, data retention, access control, reproducibility.
  Probabilistic systems make all of these harder, not easier.
- **Cost**: sometimes a canned function call is the right answer because
  it's a thousand times cheaper and faster than a model call. Sometimes
  the model is worth the price because the interface flexibility it
  provides would take months to replicate in code, if ever.

Making those decisions well requires deep technical understanding. Not
less of it. **More of it**. You can't reason about the boundary between
deterministic and probabilistic workloads if you don't deeply understand
both.

## The job displacement narrative, inverted

Here is where the article makes its most interesting move. The dominant
"AI will take our jobs" narrative assumes a simple substitution: the
machine does what the human used to do, much cheaper and faster, and the
human becomes redundant. Applied to software engineering, it means: AI
writes the code, so why do we need programmers?

This view misses the structural reality of technological change. Every
major productivity leap in history has followed the same pattern:
automation makes existing work cheaper, cheaper work unlocks demand that
was previously uneconomical, and total demand grows rather than shrinks.
Economists call this the _Jevons Paradox_. When steam engines made coal
extraction more efficient, coal consumption went up, not down, because
cheaper coal enabled uses that weren't viable before.

The article applies the same logic to software. If AI agents make
engineers two to ten times more productive, a lot of projects that were
previously "not worth the effort" suddenly become viable. Every small
business that couldn't afford custom software now can. Every niche
workflow that didn't justify a dedicated tool now does. Every internal
process that used to be a spreadsheet can become a proper application.

The quote that stuck with me: *"Demand doesn't shrink. It diffuses
across the entire economy."*

Software stops being a thing that tech companies do and becomes a thing
that every organization needs. And every one of those projects needs
someone who can decide which computer handles which workload, where the
boundaries are, and what happens when something breaks.

## What the market is actually doing

You don't have to take this argument on faith. The article points out
that, despite the job-destruction rhetoric, engineering positions
recently hit three-year highs. What's being hired for, specifically, is
senior talent. The kind of engineers who can look at a problem and make
sensible decisions about architecture, trade-offs, failure modes, and
system boundaries.

This tracks with something I wrote about in a
[previous post](/posts/20260407-ai-assisted-coding-as-a-tool-for-good-practices/):
AI coding agents amplify the expertise you already have. They're a lever.
And levers are only useful if you have something solid to push against.
A senior engineer with an AI agent can now produce in a day what used to
take a week, at the same quality level or even better. A junior who
doesn't know what good looks like gets fast output, but at unpredictable
quality.

The market is responding exactly how you'd expect. Companies are betting
on the people who can use the lever efficiently, not trying to replace
them.

## What this probably means

The reality is almost certainly nowhere near either extreme. AI isn't
going to eliminate software engineering, but it isn't going to leave it
untouched either. The nature of the work is shifting. The boring parts
(boilerplate, glue code, first drafts, documentation) are becoming
cheaper. The interesting parts (architectural decisions, system
boundaries, failure analysis, security reasoning, legal and regulatory
implications) are becoming more important.

If you enjoy the interesting parts, the next decade looks pretty good.
If your job was mostly the boring parts, the next decade looks harder.
Not because the machines are coming for you, but because the value of
your work is being redistributed toward the parts that require judgment.

This isn't a particularly comforting take if you're halfway through a
career built on the boring parts. Unfortunately, it is the very nature of
a software engineering career to do a lot of the "boring" to become
good at the "important". It is a matter of evolution in the craft and
acquiring experience by seeing things running and observing the decisions of
more senior engineers.

Whether we will be able to train new junior engineers into competent ones
at the rate the market needs remains an open question. In any case, the
view presented in this article is a much more lucid one than either
"ship everything to agents right now" or "it's all over, start learning to
bake bread".

The world needs people who can reason about complex systems, now more
than ever. We need more of them, in fact, precisely because the systems
just got way more complex.

For those of us who got into software because we liked thinking hard
about hard problems, this is actually good news. The craft didn't get
easier, it got more interesting. And the world suddenly needs more of
us, not less. That is not a bad place to be.
