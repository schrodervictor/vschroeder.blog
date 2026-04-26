---
title: "Vibe coders: baby programmers?"
description: >
  Most takes on vibe coders are negative, and well deserved. Then I watched a
  30-second video that reframed the whole thing, and a second one that pulled me
  right back. A post that bounces between the two, ends pessimistic, and still
  finds a reason for hope.
pubDate: 2026-04-25
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - learning
  - practices
---

Most takes on vibe coders focus on the output: hallucinated APIs, security
holes, unmaintainable code, logic that looks plausible until you actually run
it. I agree with most (all?) of those takes.

Then I watched a short 30s video by
[Alberta Tech](https://www.youtube.com/@albertatech) that reframed the whole
thing for me, and I haven't been able to let it go.

<div class="video-wrapper">
  <iframe
    src="https://www.youtube.com/embed/QZCHax14ImA"
    title="Alberta Tech - Vibe coders are just learning to code"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>

Her argument, in one line: what if vibe coders are just programmers in their
larval stage? A massive influx of people touching code for the first time,
except they're making it a lot further into "working software" than any of us
could have at their stage.

Before AI, the standard advice to anyone learning to code was "just start
building." Vibe coders are doing exactly that. They're just getting way further,
way faster.

## Haven't we all done this?

Think back to the first thing you ever built that ran somewhere other than your
computer. Did you understand what you were doing? I mean _really_ understand.
Not the syntax. The actual _what_.

Looking back, I certainly didn't. Sometimes I _thought_ I did, but a new error
or unexpected behavior in production would throw me back into researching to
find out many nuances and complexities I was 100% unaware of.

Many of us did stuff that we wouldn't be very proud of, looking back.
Copy-pasted snippets from forums. Tweaked them until they finally compiled.
Learned about SQL injection the hard way. Discovered the importance of HTTPS
because someone you respected told you your security was a joke.

Truth be told, I was always careful about using code that I didn't understand.
It's more of a personality trait; I usually want to know how things work behind
the scenes. It has motivated me to spend time on research and brought me
valuable lessons over the years.

But I certainly learned many things the hard way and in production. Caching
because the dashboard was too slow. Then feeling like a hero because caching is
such an easy win. Then learning how caching is actually one of the hardest
things you'll ever implement and becoming reluctant about it until you really,
really need it. Such are the ways of software craftsmanship.

Every one of those lessons arrived as a consequence, whether through practical
research or from a slow website in production. Not from a textbook, not from a
mentor, not from a "best practices" guide I sat down to read. From something
that broke in public.

Computer science has a long and proud tradition of copy-pasting code we don't
understand and hoping it compiles. Vibe coding is an accelerated, more
hallucinated version of the same tradition. It feels dishonest to call the vibe
coders lazy when the rest of us did this too, just slower.

## But learning lives in the friction

Here's the counterpoint, courtesy of a second video by
[ThePrimeagen](https://www.youtube.com/@ThePrimeTimeagen):

<div class="video-wrapper">
  <iframe
    src="https://www.youtube.com/embed/u1AN5n6jo_w"
    title="The PrimeTime - The Best Way To Learn Programming"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>

He makes a distinction I can't un-see: there's a difference between the "final
result" and the process of "learning."

The final result is the working code, after everything else was tried. The
learning is the "everything else" in the middle. The tries that didn't work. The
print statements. The twenty-minute detour through the wrong library. The
misread error message. The eventual realization of what the error message
actually meant.

If someone hands you the final result, you get a working program. But the
learning, he argues, happened in the stuff that got cut out.

That is exactly what AI does. It hands you the final result. The tiny failures,
the small bits of friction that used to teach you how things actually work, are
silently absorbed by the model. You don't get the compile error that would have
forced you to read about pointers. You don't get the silent off-by-one that
would have made you internalize zero-indexing. You just get code that works,
most of the time.

## Copy-paste, then and now

I still want to push back on that a little, because every generation of
programmers has had its version of "final result" shortcuts. Visual Basic
drag-and-drop. WordPress plugins. jQuery's `$` that made everything "just work"
on the browser. Rails scaffolding. Copilot autocomplete. Each one was, in its
moment, a magic shortcut that produced a working thing without requiring real
understanding or effort.

And most people who used those tools never went deeper. That's probably fine.
They shipped features, solved problems, got on with their lives. The minority
who wanted more went down the stack. Read the source. Found the abstraction
leaks. Fixed bugs. Eventually understood the whole thing.

The people who now maintain critical infrastructure came mostly from that
minority. The majority built a ton of software too, much of it mediocre, some of
it good enough. The industry worked because both groups existed.

Is vibe coding really that different?

## Did we finally kill the path to learning?

Here's where I get pessimistic.

The shortcuts of the past were slow. A WordPress plugin was still an artifact
you could inspect. You could open the PHP file, read through it, and if you were
the kind of person who asks questions, you'd find answers. Speed was bounded by
human thought.

AI code doesn't have a human pace. It produces a thousand lines of plausible,
mostly-working code in seconds. You can generate an entire microservice while
you finish your coffee. The artifact is already huge before you've had a chance
to understand what's in it.

That changes the learning loop in ways I'm not sure we fully appreciate yet.

When your jQuery app broke, you had no choice but to dig in. The bug was in code
you at least pretended to own. When your vibe-coded app breaks, you paste the
error back into the chat and the agent fixes it. The loop that used to force
curiosity has been short-circuited. You don't need to understand the bug to make
it go away, and needing to understand was exactly the mechanism that taught us
so much.

And when the failures do come, they're not the micro-failures that teach.
They're macro-failures. Not "this function isn't returning the right value," but
"the system behaves strangely under load, I have no idea why, and the codebase
is thirty thousand lines I never read." The classic path from micro-failure to
curiosity to understanding to better design doesn't operate at that scale. You
can't reasonably reverse-engineer a system you never assembled, especially if
you don't have years of experience backing you up.

## Except curiosity doesn't go away

None of this changes the fact that some people just want to know how things
work. That impulse has survived every previous shortcut, and I don't think AI
kills it. If anything, AI removes a lot of the accidental friction that used to
exhaust would-be learners before they got to the interesting parts. You can
start a side project in five minutes and spend a year digging into its
internals. The depth is still there, for anyone who wants it.

Without the "micro-friction" many more people will just try to do stuff. When
you had to search each error message and syntax detail in documentation online
or StackOverflow, most of them would simply give up much earlier in the process.
"Too complicated". "I don't get it". "I'll never make it work". Now they are
sticking around.

Proportionally, the curious minority will be smaller. Much smaller. The friction
that used to accidentally educate the majority is gone. A huge number of people
will build many things and learn very little. That's probably just true.

But the curious few will have more leverage than any generation of programmers
in history. They'll read AI-generated code and actually understand it. They'll
question it, correct it, know when to trust it and when to throw it out. They'll
be a strange new species: raised on the tools, but refusing to let the tools
think for them. Hyper-efficient hybrids, unlike anything the industry has
produced before.

I don't know how many of them there will be. I suspect the number is small. I
also suspect that, ten or twenty years from now, the people who understand the
systems actually running the world will be drawn almost entirely from that small
group. Being able to build without understanding won't be the rare skill. Being
able to understand, in spite of being able to build without it, will be.
