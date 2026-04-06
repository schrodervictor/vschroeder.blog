---
title: A smart copy button for shell snippets
description: >
  Building an intelligent copy button that extracts only the commands from
  shell snippets, handling prompts, continuations, heredocs, and output.
pubDate: 2026-04-06
author: Victor Schroeder
tags:
  - javascript
  - astro
  - blog
  - meta
---

In the [first post](/posts/20260405-building-this-blog/) I showed how posts on
this blog are written in Markdown with fenced code blocks. What I didn't
mention is the small, annoying problem that comes with documenting shell
sessions.

## The problem

When I write a tutorial, I want the reader to see exactly what a terminal
session looks like: the command they type and the output they get back. Like
this:

```shell
$ terraform init
Initializing the backend...
Successfully configured the backend "gcs"!

$ terraform plan
Plan: 5 to add, 0 to change, 0 to destroy.
```

But when someone clicks "Copy" on that block, what should end up in their
clipboard? The raw text includes prompts (`$ `), command output, and sometimes
comments. If you paste the whole thing into a terminal, you get garbage.

What you actually want is just the commands:

```
terraform init
terraform plan
```

That sounds simple, until you consider multiline commands:

```shell
$ docker run \
    --rm \
    -v "$(pwd):/app" \
    -it ubuntu
root@abc123:/#
```

And heredocs:

```shell
$ cat > config.yaml <<'EOF'
server:
  host: localhost
  port: 8080
  logging:
    level: debug
EOF
```

The copy button needs to understand the structure of a shell session, not
just strip lines that start with `$`.

## Convention first, code second

Before writing any parsing logic, I established a convention for how shell
snippets are written in Markdown on this blog:

- **Commands** start with `$ ` (dollar sign + space)
- **Comments** start with `# ` (hash + space), these are preserved
- **Continuation lines** follow a line ending with `\`
- **Heredoc bodies** follow a line containing `<<LABEL` until `LABEL` appears
  alone on a line
- **Everything else** is output and gets skipped

This also maps to a design decision in the
[CSS](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/styles/code.css).
The blog uses two different
language hints for shell-related code:

- `shell`: interactive sessions with prompts and output, no line numbers
- `bash`, `sh`, `zsh`: scripts with line numbers, no prompts

The `shell` hint tells both the CSS (skip line numbers) and the copy button
(extract commands) that this is an interactive snippet.

## The extraction logic

The core is a small state machine that walks through the text line by line,
tracking whether it's inside a continuation or a heredoc:

```typescript
export function extractShellCommands(text: string): string {
  const lines = text.split('\n');
  const result = [];
  let capturing = false;
  let inHeredoc = false;
  let heredocLabel = '';

  for (const line of lines) {
    if (inHeredoc) {
      result.push(line);
      if (line.trimEnd() === heredocLabel) {
        inHeredoc = false;
        heredocLabel = '';
      }
      continue;
    }

    if (line.startsWith('$ ') || line.startsWith('# ')) {
      const content = line.startsWith('$ ') ? line.slice(2) : line;
      result.push(content);
      heredocLabel = findHeredocDelimiter(content);
      inHeredoc = heredocLabel !== '';
      capturing = !inHeredoc && content.endsWith('\\');
      continue;
    }

    if (capturing) {
      result.push(line);
      heredocLabel = findHeredocDelimiter(line);
      inHeredoc = heredocLabel !== '';
      capturing = !inHeredoc && line.endsWith('\\');
    }
  }

  return result.join('\n');
}
```

Three states drive the logic:

1. **Default**: only lines starting with `$ ` or `# ` are captured. The `$ `
   prefix is stripped; `# ` is kept as-is (it's a valid shell comment).
2. **Capturing continuations**: when a captured line ends with `\`, the next
   line is also captured regardless of what it starts with. This continues
   until a line doesn't end with `\`.
3. **Inside heredoc**: when a captured line (or continuation line) contains
   `<<LABEL`, every subsequent line is captured verbatim until `LABEL`
   appears alone on a line.

The heredoc detection is its own function:

```typescript
export function findHeredocDelimiter(line: string): string {
  const match = line.match(/<<-?\s*['"]?(\w+)['"]?/);
  return match ? match[1] : '';
}
```

It handles all the common heredoc forms: `<<EOF`, `<<-EOF` (for indented
heredocs), `<<'EOF'` (no variable expansion), and `<<"EOF"`.

## Wiring it to the copy button

The copy button itself is straightforward. On `DOMContentLoaded`, the script in
[`PostLayout.astro`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/layouts/PostLayout.astro)
wraps each code block in a container with a title bar showing the language and
a copy button. The interesting part is one line:

```typescript
const code = lang === 'shell' ? extractShellCommands(raw) : raw;
```

For shell blocks, the raw text goes through the extraction function. For
everything else (TypeScript, YAML, plain text), it copies verbatim. The
language hint that Shiki already puts on each `<pre>` block as a
`data-language` attribute is all we need to make the decision.

## Testing it

Since this logic has enough edge cases to make me nervous, I extracted the
functions into their own module
([`src/lib/shell-commands.ts`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/lib/shell-commands.ts))
and wrote [unit tests](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/lib/shell-commands.test.ts)
with vitest.

Some of the cases worth testing explicitly:

```typescript
it('strips $ prompt but keeps # comments', () => {
  const input = [
    '# this is a comment',
    '$ ls -la',
    'total 42',
  ].join('\n');
  expect(extractShellCommands(input)).toBe(
    ['# this is a comment', 'ls -la'].join('\n')
  );
});

it('preserves tab indentation inside heredoc', () => {
  const input = [
    "$ cat > Makefile <<'EOF'",
    'build:',
    '\tgo build -o bin/app',
    '',
    'test:',
    '\tgo test ./...',
    'EOF',
  ].join('\n');
  expect(extractShellCommands(input)).toBe(
    [
      "cat > Makefile <<'EOF'",
      'build:',
      '\tgo build -o bin/app',
      '',
      'test:',
      '\tgo test ./...',
      'EOF',
    ].join('\n')
  );
});
```

Indentation inside heredocs is critical. A Makefile with spaces instead of
tabs is broken. The function preserves whitespace exactly as written.

Running the suite:

```shell
$ make test
npx vitest run

 RUN  v4.1.2

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  112ms
```

## The full picture

The feature spans three layers:

1. **Convention**: Markdown authors write `$ ` before commands, which doubles
   as a visual prompt for readers
2. **CSS**: `shell` blocks get no line numbers; `bash`/`sh`/`zsh` blocks get
   line numbers (they're scripts, not interactive sessions)
3. **JavaScript**: the copy button parses `shell` blocks to extract only the
   executable parts; other languages copy raw

Each layer is simple on its own. The complexity (and the part worth testing)
is in the extraction logic's state machine and its interaction with shell
conventions that have existed since the 70s.

It's a small feature, but it's the kind of thing that makes technical
documentation actually usable. Copy should give you something you can paste
and run.
