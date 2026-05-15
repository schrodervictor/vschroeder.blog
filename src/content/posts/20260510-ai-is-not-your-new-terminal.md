---
title: AI is NOT your new terminal
description: >
  I caught myself prompting an AI agent to create a Git branch. The prompt had
  more keystrokes than the command. That moment revealed something uncomfortable
  about how we're starting to confuse two very different tools.
pubDate: 2026-05-10
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - practices
  - philosophy
---

Last Friday, I met very dear colleagues for a round (or two, or more) of drinks
after work. Of course the conversation drifted to AI at some point. Nobody talks
about anything else these days, right?

We started sharing how we use it at work and how ubiquitous it had become. I
walk around my office during the day and _everyone_ has a terminal with Claude
Code open.

Every. Single. Person.

It has become the default interface for getting stuff done.

And then an emerging pattern came up: as everyone uses AI on a daily basis now,
almost non-stop, we start off-loading the most trivial tasks to it. Really
stupid stuff. Things we _know_ how to do. Things we've been doing for years.

## Nobody is immune

Then, I told them an anecdote. The other day I caught myself prompting Claude to
create a new Git branch. Hey, don't judge me! The prompt went something like
this: "create a new git branch for the task we just discussed."

How _stupid_ is that?

I know perfectly well how to create a Git branch. It's a simple command I've
been using for decades:

```shell
$ git checkout -b feat/my-new-feature
```

But there I was, prompting an AI agent to do it for me. The prompt itself had
more keystrokes than the command. That prompt (with all the system prompt, tool
definitions, MCPs, etc) would be sent to an external API, activate a remote
model with several billion parameters living on extremely expensive GPUs, come
back as a response, get parsed by the agent harness, and finally execute a bash
command that, hopefully, maybe (but likely) would achieve my intent. And it
would take much, much longer.

I stopped myself, slapped my hand and just created the freaking branch on the
terminal open next to it. But I know for a fact I did it through the agent a few
times before without even thinking.

## Why on Earth would I want to do that?

The obvious answer would be laziness, but I'm not exactly lazy. I'm the kind of
person who doesn't like even autocompletion from IDEs, so I don't think that's
it. Something more subtle was happening.

One aspect is that I was looking at the agent harness as if it were a terminal.
The prompt was my command. Type something, get a result. Same mental model,
right?

Wrong. These are wildly different things.

A **terminal** is a direct interface to your operating system. You are always in
control. You type a command, the shell interprets it, the kernel executes it.
There is no ambiguity. A `git checkout -b foo` will always create a branch
called `foo`. Even when you make a mistake, the mistake is all yours to enjoy.
The feedback loop is instantaneous and deterministic. The mapping between intent
and outcome is one-to-one.

An **AI agent** is a probabilistic system wrapped in a conversation interface
that just happens to be on the terminal. Your prompt is **not** a command. It is
a polite request expressed in natural language, interpreted by a model that
makes its best guess at what you meant, translated into one or more tool calls,
each of which may or may not match your actual intent. The feedback loop is
slower. The mapping between intent and outcome is approximate at most.

When you type a `git checkout -b whatever` in a terminal, you get exactly that
branch. When you type "create a new git branch for this task" into an agent, you
get a branch with a name the model decided for you, formatted according to
whatever patterns it inferred from your repo. Maybe it's great. Maybe it's
`feature/implement-task-xyz` when your convention is `fix/xyz`. You won't know
until you check what the agent did.

The terminal is deterministic. The agent is probabilistic. They look and feel
alike on the screen, two text interfaces waiting for your input. But the thing
happening behind the cursor is fundamentally different.

It's like the difference between flipping a light switch and asking someone to
"turn on the lights." The switch is direct, mechanical, predictable. The person
will probably turn on the lights, but they might turn on the wrong ones, or all
of them, or ask you which lights you mean. For complex tasks, asking a person
(or an agent) can be a great time saver, but it essentially translates into a
management activity. For flipping a switch, just flip the damn switch.

## The real temptation

But there was something else going on, deeper, and this is the part that bothers
me most.

I was also off-loading the _thinking_. Not the execution. The mental effort of
micro decision-making.

Naming a branch is a trivial decision. But it is a decision nevertheless. You
look at the task, consider the convention, pick a prefix (is it `feat/`, `fix/`,
`chore/`?), summarize the intent in a few words, and type it. Takes five seconds
and requires a tiny bit of judgment.

I knew the agent would check the existing branches, figure out the naming
convention, and create something aligned without me having to think about it.
And that was what lured me. Not saving keystrokes. Saving one small, tiny
decision.

This is where it gets dangerous.

That tiny decision, the one about the branch name? It's a form of engagement
with the task. It forces you to articulate, even if just to yourself, what
you're about to do. `fix/race-condition-in-queue` tells you something. It
anchors you. It's a micro-commitment.

When you off-load that to the agent, you skip the articulation. You go from "I
have a task" to "the agent is working on it" without passing through the step
where _you_ define what the task is in your own terms. You lose the mental
checkpoint.

And if you're willing to off-load even _naming a branch_, what's next?

## The atrophy problem

There is a well-known principle in both medicine and engineering: stop using a
muscle and it atrophies. Stop exercising a cognitive skill and it weakens.

This is not hypothetical. I've seen it happen. Some people get so addicted to
autocompletion that they can't proceed a few seconds without hitting Ctrl+Space.
Is it more efficient? Not at all! I often saw them checking function signatures
_every single time_, reading the popup instructions on screen; stuff that would
be natural to memorize just by repetitive use, if you take the time to
internalize the concepts in the first two or three times you call it.

It's a small thing? Sure, but small things compound.

The branch-naming example is trivial in isolation. But it represents a pattern:
the gradual, almost imperceptible delegation of cognitive effort to a machine.
Each individual delegation is harmless. The compound effect over months and
years is not.

For example, I started driving before GPS navigation was widely available. I
would check the route at home before leaving using maps and collect mental
points of reference. Sometimes I would have to ask directions on the way. Is it
efficient? In the first few times absolutely not, but quickly I could get
everywhere I wanted in Rio de Janeiro. And Rio is HUGE.

Now, nobody learns how to drive like that anymore. Even taxi drivers have GPS in
front of them all the time. More efficient? Probably, but in Rio it will send
you inside the "favelas" for a dangerous ride sometimes. And because you _don't
know your way around the city_, you can't make any judgment if the chosen path
is safe or not.

## Drawing the boundary

So where should the line be?

I'm still trying to find a universal answer. In general, if something takes less
time than it would require to get a reply from the agent, just do it yourself.
If the outcome is relatively simple and requires a longer prompt because you
have to give more context to the model, also just skip the hurdle and do it
directly.

```shell
# Do this yourself
$ git checkout -b fix/race-condition-in-queue
$ mkdir -p src/lib
$ mv old-name.ts new-name.ts
$ git add -A && git commit -m "fixes :)"
```

You don't need an assistant for any of these. You need your fingers on the
keyboard, your brain making the small decisions, your muscle memory staying
sharp.

Save the agent for what it's actually good at: the complex, multi-step,
research-heavy tasks where a probabilistic system adds genuine value. Writing a
parser. Exploring an unfamiliar codebase. Drafting a test suite. Reasoning about
architecture trade-offs. These are the tasks where the approximate, creative,
contextual nature of an LLM is a strength, not a liability.

The terminal is your lightsaber. Precise, deterministic, follows your moves,
cuts your enemies in half (ouch, ok, too much). The agent is the ship's
computer: powerful, useful for complex queries, runs challenging simulations,
hallucinates in the holodeck.

## Keep your brain working

As for myself, I'm not creating branches through Claude Code anymore. Neither
should you.

It sounds like a small thing because it is. Small habits shape how you relate to
your tools. If you train yourself to reach for the agent every time you need to
_do_ something, you'll eventually forget that you can _do_ things. And when the
agent is wrong (and it will be), you won't have the instinct to catch it,
because you've been out of the loop for just too long.

Draw a boundary between the agent and your terminal. Keep the simple stuff on
your side and keep your brain working. The agent is an extraordinary tool. But
it's **NOT** your new terminal.
