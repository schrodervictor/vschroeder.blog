---
title: The Agile hangover
description: >
  Writing precise specs so AI agents don't drift feels oddly familiar.
  It looks a lot like the structured engineering of the 1970s and 80s,
  the very thing Agile promised to replace. Maybe we're feeling the
  hangover of decades of loose planning, and the cure is to start
  engineering again.
pubDate: 2026-04-21
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - agile
  - philosophy
---

A lot has been said about how AI changes the programming craft. On one
end you have the "vibe coders", shipping things they don't understand.
I'm not going to discuss them here. They are not to be taken seriously
as professionals.

On the other end, you have engineers using AI assistance deliberately.
As the tools become smarter, they can work more autonomously. Turning
on "auto-accept" for edits is moving from the exception to the rule,
because the output is genuinely good under the right guidance.

But even with good guidance, AI-generated implementations can drift.
When they do, a lot of work, tokens, and time can be wasted. The
implementation can go so far off track that you need to start over.

That's why we see constant reports saying the engineering focus has
shifted away from hands on the keyboard toward two extremes:
**validation** (code review, testing, catching errors after the code
is generated) and **specification** (writing technical specs so precise
that the agent doesn't have much room to make mistakes).

When it comes to validation, well-established techniques like TDD can
help tremendously. But today I want to focus on the specification side,
because it brought me some eye-opening insights.

## This looks familiar

When you sit down to write a specification detailed enough that an AI
agent can implement it correctly, what does that work actually look
like?

It looks like defining system behavior formally. Drawing state
machines. Writing sequential analysis of data flows. Documenting
decision trees, module boundaries, input/output contracts,
preconditions and postconditions. Specifying not just *what* the
system should do, but *how* it should be structured internally.

If you've read anything about software engineering history, this
should sound familiar. Because this is exactly what software
engineering looked like in the 1970s and 1980s.

Before Agile, before Scrum, before the manifesto, software was built
through structured methodologies. Formal specification languages like
Z and VDM. Rigorous design documents reviewed before a single line of
code was written. Techniques like structured analysis and structured
design (SA/SD), data flow diagrams, entity-relationship modeling. The
discipline drew heavily from established engineering fields. Civil
engineers don't start pouring concrete before the blueprints are done.
Electrical engineers don't solder components before the circuit is
designed. Software engineering, in its original incarnation, followed
the same principle: think first, build second.

The work was slow, methodical, and expensive. It required experienced
people, took a lot of time, and produced mountains of documentation.
But it also produced systems that were deeply understood before they
were built.

## Conceptual integrity

I had the opportunity to read Frederick Brooks' magnificent book _The
Mythical Man-Month_, originally published in 1975. When I first held
it in my hands about ten years ago, it read almost as a historical
report on how things were done. Interesting, but distant.

The concept that stuck with me the most was what Brooks called
"conceptual integrity": the idea that a system should
look as if it were designed by a single mind, even if it was built by
many hands. Brooks argued that a single person or a very small group
should be responsible for maintaining this consistency across the
entire system. The architect, not the committee.

Despite its age, the book contains lessons applicable to this day. Or
at least I thought so when I read it, before the AI boom.

Now I think those lessons are not just applicable. They might be more
relevant than they've been in decades.

## What happened in between

Something significant happened between the structured era and the
present. It took many names: Agile, eXtreme Programming, Scrum,
Kanban, and many more variations. The core promise was the same:
make the planning part (which was the expensive one, required
experienced people, took a lot of time) more "loose". Offload
implementation details to the discretion of the software engineers.
Leverage their experience to fill the gaps and mostly hope that the
development team would complete the work reasonably.

There is a lot of value in Agile principles and the overall movement
was a necessary correction. Waterfall had real problems: by the time
you finished specifying, the requirements had changed. Feedback loops
were too long. Adaptation was too slow. The Agile movement addressed
those problems, and the industry genuinely improved because of it.

But something was lost in the process.

It was around the same time that "software engineers" started losing
the "engineer" part of their role names. They became "developers".
That, maybe, was the biggest loss. Not the title itself, but what the
title change revealed: the engineering work (specifications, planning,
validation strategy) was being quietly stripped away. The expectation
shifted from "engineer the solution" to "just build something and
iterate."

What filled the gap was human judgment. Experienced developers carried
the missing engineering work in their heads. They knew which corners
could be cut, which couldn't, what the trade-offs were, how systems
failed. The specifications were thin, but the people were deep. And
it worked, more or less, because the people doing the implementation
had enough context to compensate for the missing formality.

## The hangover

So here we are. Decades of loose planning, thin specifications, and
heavy reliance on human experience to fill the gaps. And now we're
handing the implementation to AI agents that have no experience, no
context beyond what we give them, and no judgment about what was left
unsaid.

The friction is obvious. The agents need precise instructions. They
need detailed specifications. They need exactly the kind of
structured, formal, thorough engineering documentation that the
industry spent decades learning to skip.

Are we feeling an Agile hangover? I think so. But apparently we just
keep "drinking."

Because the response from many companies isn't to invest in better
specifications. It's to make them even looser. Specs become prompts
written in seconds. The implementation is no longer done by humans
filling the gaps with their experience, but by a model trained on
data from the internet. The planning got thinner. The implementer got
less capable of compensating. And somehow the expectation is that the
output will be better.

## The ones who got it right

But not everyone is going down that path. Many companies and teams
have already realized that AI is a tool to be used in the right hands,
and that it can achieve remarkable things. It can help deliver
excellent quality in reasonable time. And you don't have to compromise
engineering principles for that. In fact, that's precisely the point:
these principles have never been more important than now.

With the speed AI agents can produce code, we need to spend
proportionally more time on validation and specification. More like the
structured era of the 1970s and 80s, but with far more capable tools.
The blueprints still come first. The engineering still happens before
the building. The difference is that the builder is now extraordinarily
fast, which makes the quality of the blueprint more critical than ever.

Brooks' "conceptual integrity" matters more than ever. When an AI
agent can generate a thousand lines of code in minutes, the thing that
keeps those lines coherent, consistent, and aligned with the system's
intent is not the agent. It's the person who defined the architecture.
The engineer. Not the developer. Not the prompt writer. The engineer.

## Time to put the suit back on

Maybe what we lost during the Agile era was precisely the core
engineering spirit. The specifications, the planning, the validation
strategy were likely needed all along, and we just extracted everything
we could from the human experience of the people filling the gap.

It worked for a while because the humans were good enough to
compensate. It can't work when the implementer is a machine that takes
every instruction literally and has no ability to fill in what you
forgot to say.

It's probably time to stop playing "developer" and put the suit of a
real Software Engineer back on. The title always carried a
responsibility. Now the tools demand it.
