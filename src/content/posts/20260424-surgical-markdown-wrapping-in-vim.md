---
title: A surgical Markdown wrapper for Vim
description: >
  How I built an AST-powered word wrapper to keep my 80-character Vim workflow
  without breaking the project's unwrapped Markdown standards.
pubDate: 2026-04-24
author: Victor Schroeder
tags:
  - vim
  - markdown
  - typescript
  - tooling
---

I love short lines of text (or code). They flow better from the terminal,
through my eyes, to my brain. For this reason, I always write my Markdown files
with an 80-character hard wrap limit. It looks clean and makes standard Vim
motions like `j` and `k` behave predictably. It feels right.

Of course, not everyone agrees. Some argue that long unwrapped lines let the
viewport do the wrapping, breaking the text wherever it naturally fits. It's a
valid point, but I find myself much more often struggling to read very long
lines, rather than mildly bothered by mangled text on a very narrow screen. Even
a laptop screen these days often has 200 columns or more in the terminal, and
narrow windows are hard to read on anyway.

But, as it happens, I recently started contributing to a project that follows
the long, unwrapped lines standard for Markdown files. The paragraphs must be
saved as single, continuous lines. And they have a lot of Markdown files, given
the recent popularity "explosion" of AI-beloved Markdown files.

So, I had a choice: abandon my preferred workflow and be constantly bothered by
those long lines on my screen, or build a bespoke tool to bridge the gap.
Obviously, I chose the latter.

## Why not use soft wrap?

I'm glad that you asked.

The fundamental issue with soft wrap is that it depends on the viewport width
and will adapt to it: soft-wrapped lines are fluid by definition. Curiously
enough, this is exactly the same fact that makes people defend the long
unwrapped lines in the first place. Humans are so interesting.

You see, my workflow is 100% terminal-based. Tmux and Vim are the backbone of
it. The most frequent layout I use is to have several Tmux windows (the "tabs"
that stack in front of each other), each one usually split vertically in two
panes (the "regions" inside each "tab"). There are some variations, but this is
80%+ of what I'll be staring at.

On a small screen such as a laptop, soft wrap doesn't bother me too much. The
long lines will be wrapped at roughly the 100th column and read okay... as long
as the layout stays static! When editing files inside Tmux, `Ctrl-b z` zooms
into the current pane for a distraction-free full-screen view.

But as soon as I do that, or maybe just move the terminal to another screen, the
relative position of the words in that paragraph I wanted to edit changes. This
issue is waaaay worse on big screens, because suddenly the insert position may
be what feels like a kilometer to the right of where my eyes were looking.

On top of that, I'm a highly visual person. Constantly changing word arrangement
on the screen is not a feature for me. It makes the text unfamiliar. I like the
position determinism that hard wrapping lines bring with them.

## The naive approaches

So, I thought, I'll be opening these files using Vim. Let me wrap these lines
when entering the buffer for reading/editing and unwrap them when saving to
preserve the project's standards. Sounds pretty easy, right?

My first thought was to use Prettier. Vim's auto-commands make this natural: run
`prettier --prose-wrap always` on `BufReadPost` (when opening the file) and
`--prose-wrap never` on `BufWritePre` (just before saving).

This worked, but Prettier is an "opinionated AST printer". It doesn't just wrap
your text; it throws away your original file and rebuilds it from scratch
according to its own rules. It normalized tables, added blank lines around
headings, and reformatted lists, producing a lot of unwanted diff noise.

If Prettier rewrites too much, what about a simple Regex or Python script? That
fails too. Writing a script that flawlessly wraps plain text while ignoring
complex nested lists, GFM tables, indented code blocks, and blockquotes is a
fool's errand.

## The surgical AST approach

The solution was to use `remark` (the exact same engine Prettier uses under the
hood), but as a surgical tool.

Instead of rewriting the entire file, I wrote a small TypeScript script using
`remark-parse` to build an Abstract Syntax Tree (AST). The script walks the
tree, finds _only_ the `paragraph` nodes, and uses their exact line numbers to
wrap or unwrap just those specific lines in the original text buffer. Tables,
HTML, code blocks, and blockquotes remain byte-for-byte identical.

The core of it looks something like this:

```typescript
// 1. Parse the AST
const tree = unified().use(remarkParse).use(remarkGfm).parse(text);

// 2. Find paragraphs
const paragraphsToModify = [];
visit(tree, "paragraph", (node) => {
  paragraphsToModify.push({
    start: node.position.start.line - 1,
    end: node.position.end.line - 1,
    // ... capture prefix and indentation ...
  });
});

// 3. Surgically wrap or unwrap those specific lines
for (const p of paragraphsToModify.reverse()) {
  // Modify text buffer backwards to avoid messing up line numbers
}
```

## Down the rabbit hole of edge cases

Wrapping plain text is easy. Wrapping Markdown is a minefield. As soon as the
script was running, the edge cases started pouring in.

### 1. Fracturing links

What happens when an 80-character break falls directly in the middle of a link,
like `[User Documentation](https://...)`? A naive word-wrapper splits it across
two lines, destroying the Markdown syntax.

**The fix:** Before wrapping, the script finds all links via Regex and swaps
them for a short placeholder (e.g., `___MDLINK_0___`). The word-wrapper then
treats it as a single unbreakable word. But there was a catch: the wrapper had
to dynamically calculate the _true_ length of the hidden link. If a 90-character
link was hidden behind a 14-character placeholder, it would drop the entire
unbroken link to its own line, perfectly preserving it.

### 2. Accidental structural markers

When an 80-character limit forces a break, sometimes the new line naturally
starts with text that looks like a Markdown structure. For example, if a line
happens to wrap exactly at `... - Published`, the next line will start with
`- `.

An edge case, sure, but a huge issue, and it happened almost immediately once I
started using the tool. When saving the file, the AST parser reads that `- ` and
thinks it's a nested sublist item, completely breaking the paragraph structure.

**The fix:** If a wrapped continuation line naturally starts with `- `, `> `, or
`1. `, the script prepends an escape character (`\- Published`). When saving and
unwrapping, it strips the escape character back out.

### 3. Duplicating numbered lists

Paragraphs inside lists need to maintain their indentation. If you wrap a bullet
point (`- `), the continuation line must be indented with two spaces. But what
if the list item is a number (`1. `)?

In an early version, unwrapping a numbered list with manual linebreaks blindly
re-applied the `1. ` prefix to each new line, resulting in duplicated numbers
like:

```markdown
1. **Some item here**:
1. This is still part of the line above
```

**The fix:** Instead of copying the structural prefix, the unwrapper prepends
blank spaces equal to the length of the original prefix. `1. ` becomes three
spaces of indentation, maintaining the block seamlessly.

### 4. Preserving intentional linebreaks

Sometimes you _want_ a hard line break inside a paragraph for readability, even
if you normally prefer long lines. Markdown is totally fine with that, but it is
a human choice that doesn't play well with automation. If the script blindly
joins all lines on save, those intentional breaks are lost.

**The fix:** A `<br>` convention. When wrapping, the script converts original
physical newlines into a visible `<br>` token. It flows with the wrapped text.
If I need a new line, I just type `<br>` in Vim. When saving, the script finds
those tokens and turns them back into real `\n` characters for the repo.

## Hooking it into Vim

With the script built, compiled, and covered by a test suite, the final step was
wiring it into Vim's auto-commands:

```vim
" Run the TypeScript wrapper based on project path
autocmd BufReadPost *.md
    \ if IsProjectMarkdown(expand('%:p')) |
    \   call CustomMarkdownWrap('wrap', 1) |
    \ endif

autocmd BufWritePre *.md
    \ if IsProjectMarkdown(expand('%:p')) |
    \   call CustomMarkdownWrap('unwrap', 0) |
    \ endif

autocmd BufWritePost *.md
    \ if IsProjectMarkdown(expand('%:p')) |
    \   call CustomMarkdownWrap('wrap', 1) |
    \ endif
```

When I open a file in a certain directory (configurable), the script wraps the
lines in it. When I hit save, it unwraps the paragraphs into long lines, writes
to disk, and instantly re-wraps everything so I can keep working. The project
gets their standard unwrapped Markdown commits, and I get to keep my
80-character Vim workflow.

The Vim script layer still had to take care of a few details, such as cursor
position, undo continuity, and buffer scroll position. Luckily Vim has literally
everything you could imagine right there to achieve your exact intent.

Once again, AI assistance (this time Pi+Gemini) turned what would have been a
weekend-long parsing project into a quick hacking session solving fun edge
cases. Having a bespoke tool that perfectly fits my workflow, fully tested and
tailored to exactly how I work, is the real power of these tools.
