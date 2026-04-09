---
title: AI-assisted coding as the ultimate defense for good practices
description: >
  How AI coding agents lower the effort barrier for doing things right,
  making clean code, tests, and proper architecture non-negotiable from
  day one.
pubDate: 2026-04-09
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - good practices
  - tests
---

There's a common narrative around AI-assisted coding that goes something
like this: AI writes code faster, so developers are more productive. While
that is usually true, it doesn't tell the whole story.

Speed of delivery is definitely an important aspect as a business value, but
when observed from the Software Engineering perspective, it may be easy
to miss a crucial point: AI removes the excuse for cutting corners.

## The "nice-to-have" trap

Every developer knows the pattern. You're building something, and you hit a
spot where the **right thing** to do is clear, but the effort to do it properly
is disproportionate to its importance. That small feature or enhancement
that would take two hours of research and another two of coding. Not critical.
Not blocking. Just... better. Just really how it should be.

In a pet project, that feature gets postponed or becomes a blackhole. In a
professional codebase with deadlines, it gets added to a backlog that nobody
will ever revisit. The pragmatic choice wins, and the codebase accumulates
small compromises that individually don't matter but collectively drag it down.
Over time it becomes the compounded product of many "good enough" decisions
and a lot of technical debt.

AI coding agents change this equation in a dramatic way.

The cognitive load is mostly not there anymore. The required research is
minimal and easily accessible. In summary, when the effort drops from hours
to minutes, the _pragmatic choice_ and the _right choice_ become the
**same thing**. What once was considered an "acceptable compromise" turns into
a literal wrong choice.

## Two examples from this blog

This blog gave me two concrete cases where I would have cut corners without
AI assistance.

### A smart copy button for shell snippets

When documenting shell sessions, I wanted the copy button to extract only
the commands, stripping prompts, output, and correctly handling multiline
commands and heredocs. The [full story](/posts/20260406-a-smart-copy-button-for-shell-snippets/)
is in a separate post, but the short version: this feature requires a small
state machine that tracks whether you're in a continuation line or inside a
heredoc body.

Without AI, I would have done the naive thing: strip lines starting with
`$ ` and call it a day. Heredoc support? Continuation lines? Maybe later.
The feature would have shipped half-broken and stayed that way.

With an AI agent, the state machine took minutes. But more importantly,
once the logic existed, the next step was obvious: extract it into its own
module
([`src/lib/shell-commands.ts`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/lib/shell-commands.ts))
and cover with
[unit tests](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/lib/shell-commands.test.ts).

Twenty-one test cases covering prompts, comments, continuations with
different indentation styles, heredocs with tabs, mixed sequences, edge
cases. The kind of test coverage that you know you should have but rarely
write for a personal blog.

The effort was so low that *not* testing it would have been harder to
justify than testing it.

### Custom syntax highlighting for APT files

The [Tor SSH guide](/posts/20260407-ssh-into-your-homelab-from-anywhere-using-tor/)
includes snippets showing APT source configuration in both the new DEB822
format and the legacy one-line format. Shiki (Astro's syntax highlighter)
doesn't support either.

The proper solution is writing custom TextMate grammars: JSON files that
define token patterns, scopes, and matching rules. Then registering them
in the Astro configuration so Shiki picks them up. I've done this kind of
thing before and it's tedious. You read the TextMate grammar spec, look at
existing grammars for reference, iterate on regex patterns until the
highlighting looks right.

It's the kind of task I would never do for two code blocks in one blog post.
I'd just use `text` as the language hint and move on with ugly, unhighlighted
snippets.

Instead, I now have two proper grammar files
([`apt-source.json`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/grammars/apt-source.json)
and
[`apt-list.json`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/grammars/apt-list.json))
that correctly highlight keywords, URIs, options, and comments. The whole
implementation, from grammar files to Astro config, took one prompt and just
a few minutes. For two code blocks. In a blog post that maybe a
hundred people will read.

But that's exactly the point! The effort was low enough that doing it right
was the path of least resistance and the outcome is exactly how it should be.

## The non-negotiable bar

Here's what shifts when AI handles the implementation effort: your standards
stop being aspirational and become the default.

I know how I want code to be structured. Extracted modules instead of
inline functions. Unit tests for anything with branching logic. Clear
separation between convention, configuration, and runtime behavior. These
aren't controversial ideas. These are industry standards that evolved during
decades and exist for very good reasons. Every experienced developer agrees
with them at their core. The disagreement is always about whether the current
task justifies the effort.

When the effort approaches zero, that disagreement disappears. You don't
negotiate with yourself about whether this particular function deserves
tests. You just tell the agent to write them. You don't debate whether
a three-state parser should be extracted into its own module. You just
do it, because it takes the same amount of effort as leaving it inline.

The bar for "good enough" rises to meet the bar for "actually good",
because the cost difference between the two has collapsed.

## The widening gap

There's a less comfortable implication here. AI coding agents amplify
what you already know.

If you understand software architecture, testing strategies, and the
trade-offs behind different approaches, you can direct an AI agent to
produce well-structured, tested, maintainable code. You know what to
ask for. You know when the output is wrong. You know which corners
are acceptable to cut and which aren't.

If you don't have that experience, you get code that works (usually)
but that you can't evaluate, can't maintain, and can't extend when
requirements change. The AI gives you an answer, but you don't know
if it's a good one.

This isn't a new problem. Inexperienced developers have always
written worse code than experienced ones. But the gap is accelerating.
An experienced developer with an AI agent can now produce in a day what
used to take a week, at the same quality level or even higher. An
inexperienced developer with an AI agent can produce the same volume in
number of lines of code, but the quality delta compounds over time.

The tool is the same. The leverage is proportional to the expertise
you bring to it.

## What all this means in practice

None of this is an argument for or against AI-assisted coding. It's an
observation about how it changes the cost structure of software decisions.

When doing the right thing costs the same as doing the quick thing, the
quick thing stops being a shortcut. It's just the wrong choice.

For this blog, that means: tested code from day one, proper syntax
highlighting even for niche formats, structured architecture even for
a static site. Not because I'm disciplined -- well, yes, that too -- but
because the cost of discipline dropped to near zero.

The interesting question isn't whether AI can write code. It's whether
you know what good code looks like well enough to ask for it.
