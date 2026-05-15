---
title: "Adding comments to a static blog: enter Giscus"
description: >
  Adding Giscus comments to a static Astro blog on Firebase is a breeze,
  but a tiny CORS detail can catch you off guard. Here is why I chose it,
  how it works, and how to successfully apply a custom theme.
pubDate: 2026-05-06
author: Victor Schroeder
tags:
  - astro
  - blog
  - debugging
  - meta
---

I wanted comments on this blog. Not a big ask: let readers leave a
note, maybe start a conversation. The kind of feature you'd expect to
take fifteen minutes, maybe twenty if you're picky about the styling.

It actually took just about that, except for some unnecessary time spent
figuring out why my custom styles were not being applied.

## Picking a comment system

For a static site, the options boil down to four categories:

1. **GitHub-backed widgets** (Giscus, Utterances): comments live in
   your repo's Discussions or Issues. Readers authenticate with GitHub.
   Free, zero infrastructure.
2. **Third-party hosted** (Disqus, Commento, Hyvor Talk): someone else
   runs the backend. Some are free with ads, some are paid.
3. **Self-hosted open source** (Remark42, Isso): you run a server.
   Full control, full responsibility.
4. **No comments at all**: just a `mailto:` link at the bottom.

I went with **Giscus**. The blog's audience is technical, so requiring
a GitHub account is a feature, not a limitation. It filters spam almost
entirely. Comments live in my repo's Discussions tab, so I own the data
and moderate through GitHub's existing tools. And the integration is,
supposedly, a single `<script>` tag.

I briefly considered building something custom on Firebase (Cloud
Functions + Firestore), since the blog is already hosted there. But
this is an open source project, and an unprotected API endpoint with
the code visible in the repo is an invitation for abuse. Rate
limiting, authentication, spam filtering: each layer is another thing
to build and maintain. Giscus gives you all of that for free, because
GitHub already solved those problems.

## The setup

Giscus needs three things:

1. **Discussions enabled** on your GitHub repo
2. The **Giscus GitHub App** installed on the repo
3. A `<script>` tag in your page template

You configure it at [giscus.app](https://giscus.app), which gives
you the script tag with the right `data-repo-id` and
`data-category-id` values. In an Astro blog, you drop it into
your post layout:

```html
<script
  src="https://giscus.app/client.js"
  data-repo="schrodervictor/vschroeder.blog"
  data-repo-id="R_kgDOR7FhAg"
  data-category-id="DIC_kwDOR7FhAs4C8Ne7"
  data-mapping="pathname"
  data-reactions-enabled="1"
  data-input-position="top"
  data-theme="noborder_dark"
  data-lang="en"
  data-loading="lazy"
  crossorigin="anonymous"
  async
></script>
```

That's it. Comments appeared. The `noborder_dark` built-in theme
looked decent enough to confirm the thing worked. Time to make it
match the blog's terminal aesthetic.

## Custom themes

Giscus supports custom themes: you point `data-theme` at a CSS file
URL, and Giscus applies it. The CSS defines a set of CSS custom
properties (colors, borders, backgrounds) that the widget consumes.

The built-in themes are
[open source](https://github.com/giscus/giscus/tree/main/styles/themes),
so I used `noborder_dark.css` as a starting point and swapped the
color values to match the blog's palette:

```css
main {
  --primary-default: 95, 186, 125;   /* #5fba7d accent */
  --bg-default: 12, 18, 16;          /* #0c1210 background */
  --color-fg-default: #b0c4b0;       /* foreground */
  --color-border-default: rgba(var(--primary-default), 0.2);
  /* ... the rest of the variables ... */
}
```

I pointed `data-theme` at the hosted CSS file and deployed.

Nothing happened.

## The silent failure

The widget loaded perfectly. The comments were there. But the custom
styles were not being applied. Borders were wrong, colors were off,
and the whole thing looked like it was ignoring my CSS file entirely.

Initially, I thought Giscus would just inject the elements directly
into my page and render in place. If that were the case, my global CSS
would naturally cascade down to the comments. Instead, inspecting the
page revealed that Giscus renders its content inside an `iframe`.

Because of that iframe structure, the custom CSS file is not consumed by
my blog directly. It is actually requested and consumed by the Giscus
application running on a different domain (`giscus.app`).

When debugging, I focused on checking if my CSS file was reachable. I
opened it in another browser tab and it loaded perfectly. What went
unnoticed was that opening the file directly does not simulate a
cross-origin situation.

## The actual problem

After some digging, I realized what was happening inside Giscus's source
code when loading the custom theme:

```javascript
const link = document.createElement('link');
link.rel = 'stylesheet';
link.crossOrigin = 'anonymous';
link.href = themeUrl;
document.head.appendChild(link);
```

`crossOrigin = 'anonymous'`. That attribute tells the browser to make
a **CORS request** when fetching the stylesheet. And CORS requests
require the server to respond with an `Access-Control-Allow-Origin`
header.

I checked my Firebase Hosting response headers:

```shell
$ curl -sI "https://vschroeder.blog/giscus.css" \
    | grep -i access-control
```

Nothing. Firebase Hosting does not send CORS headers by default. The
browser was fetching the CSS, receiving a valid response, and then
discarding it because the CORS policy said "this resource did not
explicitly allow cross-origin access."

The error _was_ visible: a red "CORS error" in the Network tab and a
clear message in the console reading "No 'Access-Control-Allow-Origin'
header is present on the requested resource." I missed it because I
was inspecting the _iframe's_ DevTools, looking at computed styles and
CSS specificity, not the console. When you are convinced the problem
is CSS, you look at CSS. The CORS errors were right there the whole
time, one tab away.

The fix was one line in `firebase.json`:

```json
{
  "source": "**/*.@(js|css)",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=3600" },
    { "key": "Access-Control-Allow-Origin", "value": "https://giscus.app" }
  ]
}
```

Deploy. Refresh. Everything worked instantly.

Every single CSS rule I had written was correct. The styles were simply
never reaching the rendering engine in the first place.

## The final result

With that tiny configuration change in place, the integration is exactly
what I wanted. Giscus handles all the heavy lifting: authentication,
spam filtering, and data ownership, while remaining completely
transparent to the reader.

The comment section now works flawlessly with a custom theme that matches
the blog's terminal aesthetic. Muted green borders, dark background,
monospace font, and the accent color on interactive elements. You can see
the great results right there at the bottom of this page.

The theme CSS is a single file in `public/giscus.css`, following the
exact structure of Giscus's built-in themes. The `data-theme` URL
includes a build-time cache buster so deploys take effect immediately:

```javascript
const giscusTheme = `${Astro.site}giscus.css?v=${Date.now()}`;
```

## The checklist

For anyone adding Giscus with a custom theme to a static site, here is
a quick checklist:

1. Discussions enabled on your GitHub repo
2. Giscus app installed on the repo
3. `<script>` tag with your `data-repo-id` and `data-category-id`
4. Custom theme CSS file hosted somewhere publicly accessible
5. **Your hosting must send `Access-Control-Allow-Origin` for the CSS
   file** (set it to `https://giscus.app`)
6. Cache busting on the theme URL to avoid stale styles after deploys

Step 5 is the one that will get you. It got me. But now I'm really happy
with the results and looking forward to receiving your comments!
