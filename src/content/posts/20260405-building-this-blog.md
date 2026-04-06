---
title: Building This Blog
description: >
  How I set up a terminal-themed tech blog with Astro: from choosing the
  stack to stripping it down for production.
pubDate: 2026-04-05
author: Victor Schroeder
tags:
  - astro
  - blog
  - meta
---

While listening to some Iron Maiden and Black Label Society, I felt the urge
to get back to blogging.

I had a nice blog about 15 (!) years ago, at https://drgeek.com.br. It was
fully written in Portuguese and had some pretty nice content. I may have that
Wordpress DB around somewhere in my backups, but who knows... If I ever find it
I'll check if any of that content is worth publishing here. Pure nostalgia!

But for now let's start from scratch. This blog should look somewhat nerd, as I
mostly write about programming and technology. Sometimes I will, however, visit
other topics such as music, travel, food, anything that I feel like talking about.

My basic idea was:
  - something that looks like a terminal
  - is easy to post from the command line
  - doesn't take much to maintain

This post walks through the decisions I made and the setup I ended up with.
The full source code is [on GitHub](https://github.com/schrodervictor/vschroeder.blog).

## Choosing the stack

There's no shortage of static site generators. The usual suspects:

- **Hugo**: fast, single binary, huge theme ecosystem. The
  [Terminal theme](https://github.com/panr/hugo-theme-terminal) is the closest
  to the aesthetic I was after.
- **Zola**: similar to Hugo, written in Rust, simpler template system.
- **11ty**: flexible, minimal opinions, Node-based.
- **Astro**: modern, component-based, Markdown-first, static output.

Hugo with the Terminal theme was the obvious first choice. But I knew I'd want
to iterate on the design: making it look more like tmux, adding vim
keybindings, building interactive elements. Hugo's Go templates are fine for
picking a theme and writing posts, but they get awkward fast when you want to
build custom UI.

Astro gives you the same easy Markdown workflow, but the component system
(standard HTML/CSS/JS, or React/Svelte if you want) makes it much easier to
evolve the frontend without fighting the template engine. And it still outputs a
fully static site, no server to maintain.

So: **Astro** for the framework, with a port of the Terminal theme as the
starting point.

## Scaffolding the project

The [astro-theme-terminal](https://github.com/dennisklappe/astro-theme-terminal)
by Dennis Klappe is a port of panr's Hugo Terminal theme to Astro. I cloned it
directly:

```shell
$ git clone https://github.com/dennisklappe/astro-theme-terminal.git blog
```

Then just `cd blog && npm install` and off you go, right? ...well, not really.
I'm too scared of supply chain attacks nowadays. Even axios got compromised
recently!

To be on the safe side, I took a good look into the `package.json`. It's basically
only Astro libraries and Typescript, but an `npm install --dry-run` reveals:

```
[...]
added 365 packages in 198ms
```

Let's be honest, we just don't know what is being installed and there's no chance
to audit 365 packages. That's the state of npm. So I made small, but important
changes:
  - added a `.npmrc` file to the repo with `ignore-scripts=true`
  - added a `Makefile` to the project. It sounds old school, but it is extremely
    useful to control what are the safe commands to run in your project, especially
    in times of "agentic coding"

In the `Makefile` I put a "proxy" target to every npm command expected to run but
the list will grow over time, with deployment targets too. Leveraging that, I
made sure:
  - All targets will honour the `package-lock.json` file through `npm clean-install`
    command, unless an explicit order to update is given
  - When an update is needed, only packages older than 7 days will be installed,
    using the `--before` flag

Another good practice is to run these things as _untrusted code_ inside an
isolated environment, such as a container. I'll explain the modifications and
explain how to do it in a following post.

You may ask: isn't this waaaay too much just for a tiny blog? Allow me to answer
that, padawan: it's not about the blog. Nobody cares about my little blog, but
I'm running many other different things on this machine, online banking, paypal,
all those online accounts logged in on my browser, crypto wallets, etc. The
list goes on.

Being careful is definitely not about this blog. It is about how to take care
of your digital life in general. Life has taught me that you can't be paranoid
enough.

## Source code structure

Anyway, once I was feeling more comfortable about it, I could proceed with
giving it a try.

A quick `make dev` and the dev server starts on `localhost:4321` with hot
reload. The project structure is straightforward:

```
src/
├── content/
│   └── posts/            # Markdown blog posts
├── components/
│   ├── PostCard.astro    # Post preview card
│   └── FormattedDate.astro
├── layouts/
│   ├── BaseLayout.astro  # Shell for every page (head, nav, footer)
│   └── PostLayout.astro  # Wraps individual posts
├── pages/
│   ├── index.astro       # Homepage
│   ├── posts/
│   │   ├── index.astro   # Post listing
│   │   └── [...slug].astro # Dynamic route: one page per post
│   ├── tags/
│   │   ├── index.astro   # All tags
│   │   └── [tag].astro   # Posts filtered by tag
│   ├── about.md
│   ├── 404.astro
│   └── rss.xml.js        # RSS feed
└── styles/
    ├── terminal.css      # Color scheme and base styles
    ├── main.css          # Layout
    └── ...               # Other modular CSS files
```

Astro uses **file-based routing**. Each `.astro` file in `src/pages/` becomes a
URL. The `[...slug].astro` and `[tag].astro` files are dynamic routes that
Astro generates as one HTML page per post (or per tag) at build time.

## How content works

Posts are Markdown files with YAML frontmatter, validated by a Zod schema in
[`src/content.config.ts`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/content.config.ts):

```typescript
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    image: z.string().optional(),
    externalLink: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

If you mess up the frontmatter, Astro fails the build with a clear error message
instead of silently rendering garbage. Write a post with an invalid date and
you'll see something like:

```
[ERROR] posts/my-post.md frontmatter does not match schema
  pubDate: Expected date, received string
```

A post file looks like this:

```markdown
---
title: 'My Post'
description: 'A short description'
pubDate: 2026-04-04
author: 'Victor Schroeder'
tags: ['astro', 'blog']
---

Your Markdown content here...
```

Pages fetch posts using Astro's content collection API:

```typescript
import { getCollection } from 'astro:content';

const posts = (await getCollection('posts'))
  .filter(post => !post.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
```

Draft posts are filtered out at build time. Set `draft: true` in the frontmatter
to hide a post without deleting it.

## The terminal aesthetic

The entire visual identity comes from a handful of CSS custom properties in
[`src/styles/terminal.css`](https://github.com/schrodervictor/vschroeder.blog/blob/main/src/styles/terminal.css):

```css
:root {
  --background: #0c1210;
  --foreground: #b0c4b0;
  --accent: #5fba7d;
  --radius: 0;
  --font-size: 1rem;
}
```

Near-black with a green tint, muted sage text, and a medium green accent. The
idea was to evoke old phosphor CRT terminals without the eye strain of pure
`#33ff33` on black. The body font is Fira Code, a monospace font with
ligatures. Every element on the site references these variables, so swapping the
entire color scheme is a matter of changing five values.

The original theme used a monochrome syntax highlighting approach, almost
everything in the code blocks was either foreground or accent color. That's
faithful to the terminal aesthetic but hard to scan. I replaced it with a
multi-color palette that still feels at home on the dark green background:

```css
:root {
  --astro-code-token-keyword: #7ec8e3;           /* soft blue */
  --astro-code-token-function: #c3e88d;           /* lime green */
  --astro-code-token-string-expression: #ecc48d;  /* warm amber */
  --astro-code-token-constant: #f78c6c;           /* soft orange */
  --astro-code-token-selector: #c792ea;           /* muted purple */
  --astro-code-token-comment: #5e6e5e;            /* dim green-gray */
}
```

Shiki (Astro's syntax highlighter) uses the `css-variables` theme, which means
all token colors are controlled by CSS custom properties. Changing the palette
is just editing the variables. No build config or plugin needed.

Some nice details in the CSS:

- Lists use `-` instead of bullets (`ul li::before { content: "-" }`)
- Blockquotes have a `>` character as a pseudo-element
- `kbd` elements look like physical keys with a thicker bottom border
- Images get a border in the accent color
- Text selection uses accent background

## Stripping the template

The cloned repo came with demo posts, template branding, and sample pages.
Since this is now a real blog and not a theme showcase, all of that had to go.

Deleted the demo content:

```shell
$ rm src/content/posts/* public/*
```

Simplified the navigation in `src/layouts/BaseLayout.astro`, from a nested
dropdown with demo page links to a flat list:

```html
<ul class="navigation-menu__inner menu--desktop">
  <li><a href="/posts/">Posts</a></li>
  <li><a href="/tags/">Tags</a></li>
  <li><a href="/about/">About</a></li>
</ul>
```

Stripped the footer down to the essentials:

```html
<footer class="footer">
  <div class="footer__inner">
    <div class="copyright">
      <span>Powered by <a href="https://astro.build">Astro</a></span>
    </div>
  </div>
</footer>
```

Cleaned up `package.json`: renamed, removed the template author and repo
references, marked it `private`:

```json
{
  "name": "blog",
  "type": "module",
  "version": "0.1.0",
  "description": "A blog about programming and technology",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "build": "astro check && astro build",
    "preview": "astro preview"
  }
}
```

Simplified [`astro.config.mjs`](https://github.com/schrodervictor/vschroeder.blog/blob/main/astro.config.mjs). The template had a conditional `base` path for
GitHub Pages deployment. Since I'm deploying differently, none of that
is needed:

```javascript
export default defineConfig({
  site: 'https://example.com',
  base: '/',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      langs: [],
      wrap: false,
    },
  },
});
```

The `css-variables` Shiki theme is what makes syntax highlighting respect the
terminal color scheme instead of using hardcoded colors.

## The posting workflow

Writing a new post is as simple as creating a new Markdown file:

```shell
# Create the file
$ cat > src/content/posts/my-new-post.md << 'EOF'
---
title: 'My New Post'
description: 'What this post is about'
pubDate: 2026-04-04
tags: ['topic']
---

Content goes here.
EOF

# Preview locally
$ make dev

# Build and verify
$ make build
$ make preview
```

That's the whole workflow. Markdown in, static site out. No CMS, no database, no
runtime.

## What's next

The infrastructure and deployment setup will be covered in the next post.

After that, the fun part: iterating on the design. I have ideas about making
it feel more like an actual terminal: tmux-style pane layouts, a vim-like
command bar, keyboard navigation. Astro's component model makes all of that
possible without abandoning the simple Markdown posting workflow.

But for now, the blog exists. Time to start writing.
