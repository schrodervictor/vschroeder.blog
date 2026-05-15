---
title: The real cost of a "git checkout" by AI
description: >
  Yesterday I wrote about prompting an AI to create a Git branch. Today I want
  to revisit the sheer absurdity of what that request actually costs in compute,
  energy, and money. The numbers are sobering and tragically funny.
pubDate: 2026-05-11
author: Victor Schroeder
tags:
  - ai
  - software-engineering
  - philosophy
  - sustainability
---

I want to get back to the `git checkout` stupidity from
[yesterday's post](/posts/20260510-ai-is-not-your-new-terminal/). I couldn't
stop thinking about it. Not the cognitive atrophy angle (I've said enough about
that) but the sheer, magnificent absurdity of what happens _physically_ when you
ask an AI agent to create a Git branch.

I just need to let it out.

## What actually happens

You type "create a new git branch for this task" into your agent.
Thirty-something characters. Here is what follows:

Your text, all its thirty-something chars of it, gets wrapped in a massive
context payload. The system prompt alone (agent instructions, behavioral rules,
safety guidelines) is several thousand tokens. Then come the tool definitions:
every tool the agent can call, with its full JSON schema. If you have MCP
servers configured, add those too.

Then the conversation history: every message you and the agent exchanged in the
current session. Then the project context: your `CLAUDE.md`, recent git history,
file tree, git status.

By the time your "create a branch" request leaves your machine, it is carrying
**100,000 to 200,000 input tokens** of context. In my experience this is just
the nominal case. You've been planning the feature for a while, discussing the
approach, reading files. The branch creation happens mid-session, not at the
start. Your actual prompt is roughly 0.02% of the payload or even less.

All of this is serialized, compressed, and transmitted over HTTPS to a data
center that is, statistically speaking, on a different continent.

At the data center, your request lands on a cluster of GPUs. Not one GPU. A
cluster. Large language models are distributed across multiple accelerators
because no single chip has enough memory to hold the full model weights. We are
talking about hardware that costs
[$25,000 to $40,000 per unit](https://www.gmicloud.ai/en/blog/how-much-does-the-nvidia-h100-gpu-cost-in-2025-buy-vs-rent-analysis),
running at up to
[700 watts each](https://www.trgdatacenters.com/resource/nvidia-h100-power-consumption/).
Your little branch-naming request activates several of these simultaneously.

The model performs inference. Billions of floating-point operations. Matrix
multiplications across hundreds of billions of parameters. Attention heads
computing relevance scores across your entire context window. All of this to
produce a sequence of tokens that, once decoded, will read something like:

```
I'll create a new branch for you.
```

Followed by a tool call that resolves to:

```shell
$ git checkout -b feat/add-user-validation
```

The response travels back across the internet. The agent harness parses the tool
call, executes it in your local shell, captures the output, and sends it back to
the model for confirmation. Another round trip. Another inference pass. Another
burst of GPU activity. The model reads the output and produces:

```
Done! I've created the branch `feat/add-user-validation`.
```

You nod, move on and never think about it again.

## The bill

Let's put approximate numbers on this. I'm going to be conservative and round
generously in favor of the optimistic case.

A single inference request for our branch creation carries 100,000 to 200,000
input tokens and generates maybe 50 to 100 output tokens. Then the agent
executes the command, captures the output, and sends the entire context _again_
for confirmation. Two round trips. So we are looking at **200,000 to 400,000
input tokens** total for one `git checkout -b`.

Energy consumption for a single LLM inference varies wildly by model and context
size. According to
[Epoch AI's analysis](https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use),
a typical short query consumes roughly **0.3 Wh**. But that is for a few hundred
tokens. With larger context windows (10,000+ input tokens), it climbs to **2.5
Wh**. At 100,000 tokens, it reaches **40 Wh**. A recent benchmarking study,
["How Hungry is AI?"](https://www.researchgate.net/publication/391741710_How_Hungry_is_AI_Benchmarking_Energy_Water_and_Carbon_Footprint_of_LLM_Inference),
measured GPT-4o at **0.4 to 1.8 Wh** per query depending on input size, while
heavier reasoning models like o3 can reach **39 Wh**.

Our branch creation is not a short query. It carries the full weight of a
mid-session context window. Two inference passes at 100,000 to 200,000 input
tokens each. A realistic estimate is **10 to 80 Wh** total. That is the energy
to keep a 10W LED bulb on for **one to eight hours**.

For comparison, a Google search uses about **0.3 Wh**
([IEA](https://www.iea.org/energy-system/buildings/data-centres-and-data-transmission-networks)).
Our trivial branch request costs **30 to 250 times** what a Google search costs
in energy. For a command that executes locally in milliseconds.

The dollar cost is easier to pin down. At current API pricing (roughly $3 per
million input tokens, $15 per million output tokens for a frontier model), two
round trips at 150,000 input tokens each plus output runs to roughly **$0.90 to
$1.20** per branch creation. A dollar to create a git branch.

Now let's multiply.

## The multiplication problem

I walk around my office and everyone has Claude Code open. Every single person.
Let's say 50 engineers at one mid-size company. Each one makes, conservatively,
five trivial requests per day that could have been a direct terminal command.
That is 250 unnecessary inference calls per day. About 5,000 per month.

At $1 each, that is $5,000 per month. In electricity, at 30 Wh per request (a
mid-range estimate), that is 150 kWh per month. Not catastrophic. But starting
to be real money for typing commands you already know.

But we are counting only one office. The number of developers using AI coding
agents daily is measured in millions now. If even 10% of their interactions are
trivial tasks that could have been a direct command, we are looking at hundreds
of millions of unnecessary inference calls per day. Globally.

Hundreds of millions of times per day, a cluster of GPUs worth more than a
luxury car wakes up, performs billions of calculations, and produces the
equivalent of `git checkout -b something`.

At 30 Wh each, 100 million unnecessary requests per day is 3 GWh. Per day. That
is roughly the daily output of a large natural gas power plant, running around
the clock, just to help software engineers avoid typing things they already know
how to type.

## The water

GPUs generate heat. Data centers cool them. Most cooling systems use water.

Shaolei Ren's research at UC Riverside
(["Making AI Less Thirsty"](https://dl.acm.org/doi/10.1145/3724499)) estimated
that running 10 to 50 ChatGPT queries consumes roughly **500 ml of fresh
water**, depending on when and where the model is hosted. That is about 10 to 50
ml per query, evaporated as steam in cooling towers.

The
["How Hungry is AI?"](https://www.researchgate.net/publication/391741710_How_Hungry_is_AI_Benchmarking_Energy_Water_and_Carbon_Footprint_of_LLM_Inference)
benchmarking study measured GPT-4o's water footprint at under **2 ml per short
query**, rising significantly for longer contexts and heavier models
(DeepSeek-R1 topped **150 ml per query**).

The numbers are uncertain because they depend heavily on the data center's
location, cooling technology, and local climate.

But at global scale, Ren's research projects AI demand to account for **4.2 to
6.6 billion cubic meters** of water withdrawal by 2027. That is more than the
annual water withdrawal of Denmark.

Every unnecessary inference request contributes a few milliliters to that
number. Not a lot per request. But multiplied by the scale above, the numbers
stop being funny.

## The comedy of it

Here is what makes this genuinely absurd. The command
`git checkout -b feat/something` executes locally. On your machine. It touches
your filesystem, writes a few bytes to `.git/refs/heads`, and completes in
milliseconds. It uses no network. No remote compute. No cooling water. No GPUs.
The energy cost is so close to zero that it is not meaningfully measurable.

_(And it is not particularly hard, right? Come on!)_

The ratio between what the AI path costs and what the direct path costs is not
2x or 10x. It is something like 10,000x to 100,000x in energy, measured per
operation. For the exact same outcome. A branch with a name.

It is as if you wanted to boil water for tea, and instead of turning on the
kettle, you called a helicopter, flew to a volcano, lowered a bucket into the
crater, retrieved the heated water, flew back, and poured yourself a cup. The
tea would taste the same. The tea is fine. The process is clinical insanity.

## I am not against AI

Let me be absolutely clear: I am not making an argument against AI coding
agents. I use them every day. I wrote about it
[extensively](/posts/20260409-ai-assisted-coding-as-a-tool-for-good-practices/).
These tools are genuinely transformative for complex tasks.

The argument is simpler than that. Some tasks should not go through the AI path
because there is literally no benefit and the cost, however small per unit, is
not zero. It is a positive number multiplied by a very large scale. And the sum
is being paid in electricity, water, GPU hours, and dollars that could be spent
on something that actually needs intelligence.

Every unnecessary request is a tiny act of waste. Not malicious. Not dramatic.
Just wasteful. Like leaving all the lights on when you leave the room. Except in
this case, the light switch is on the other side of the planet and it powers a
small sun.

## The punchline

`git checkout -b feat/my-new-feature` takes 35 keystrokes. It executes in
milliseconds. It costs nothing. It uses no water. It generates no heat beyond
the imperceptible warmth of your own CPU flipping a few bits.

"Create a new git branch for this task" takes 37 keystrokes. It executes in
several seconds. It activates billions of floating-point operations on hardware
worth tens of thousands of dollars. It consumes measurable electricity. It
contributes to water usage in a data center you will never visit. And it might
name the branch wrong.

Same keystrokes. Several billion more calculations.

Just type the command, ffs.
