import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function postMdUrl(slug: string): string {
  return `/posts/${slug}.md`;
}

export function postHtmlUrl(slug: string): string {
  return `/posts/${slug}/`;
}

export function tagMdUrl(tag: string): string {
  return `/tags/${tag}.md`;
}

export function tagHtmlUrl(tag: string): string {
  return `/tags/${tag}/`;
}

export function mdResponse(content: string): Response {
  return new Response(content, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function getNonDraftPosts(posts: Post[]): Post[] {
  return posts
    .filter(post => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function postsList(posts: Post[]): string {
  return posts
    .map(post => `- ${formatDate(post.data.pubDate)} [${post.data.title}](${postMdUrl(post.slug)})`)
    .join('\n');
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---[\s\S]*?---\s*/, '');
}

export function deriveMdUrl(pathname: string): string {
  const clean = pathname.replace(/\/$/, '');
  return (clean === '' ? '/index' : clean) + '.md';
}

export interface PostData {
  title: string;
  description?: string;
  pubDate: Date;
  updatedDate?: Date;
  author?: string;
  tags?: string[];
}

export interface PostEntry {
  slug: string;
  data: PostData;
  body?: string;
}

export function renderPostMarkdown(
  post: PostEntry,
  prevPost: PostEntry | null,
  nextPost: PostEntry | null,
): string {
  const { title, description, pubDate, updatedDate, author, tags = [] } = post.data;
  const tagLinks = tags.map(t => `[${t}](${tagMdUrl(t)})`).join(', ');

  const lines: string[] = [
    `# ${title}`,
    '',
    `**Blog:** [vschroeder.blog](https://vschroeder.blog)  `,
    `**Author:** ${author || 'Victor Schroeder'}  `,
    `**Published:** ${formatDate(pubDate)}  `,
  ];

  if (updatedDate) {
    lines.push(`**Updated:** ${formatDate(updatedDate)}  `);
  }

  if (tags.length > 0) {
    lines.push(`**Tags:** ${tagLinks}`);
  }

  lines.push('');

  if (description) {
    lines.push(`> ${description}`, '');
  }

  lines.push(
    `[View as HTML](${postHtmlUrl(post.slug)})`,
    '',
    '---',
    '',
    post.body || '',
  );

  if (prevPost || nextPost) {
    lines.push('', '---', '');
    if (prevPost) {
      lines.push(`Previous: [${prevPost.data.title}](${postMdUrl(prevPost.slug)})  `);
    }
    if (nextPost) {
      lines.push(`Next: [${nextPost.data.title}](${postMdUrl(nextPost.slug)})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function countTags(posts: Post[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

export function renderLlmsTxt(posts: Post[]): string {
  const lines = [
    '# vschroeder.blog',
    '',
    '> Code, AI, Linux, Metal and more.',
    '',
    'A terminal-themed tech blog by Victor Schroeder.',
    'Every page on this site is available as pure Markdown by',
    'appending `.md` to the URL.',
    '',
    '## Navigation',
    '',
    '- [All posts](/posts.md)',
    '- [All posts with descriptions](/index.md)',
    '- [Tags](/tags.md)',
    '- [About](/about.md)',
    '- [RSS](/rss.xml)',
    '',
    '## Posts',
    '',
  ];

  for (const post of posts) {
    const date = formatDate(post.data.pubDate);
    const desc = post.data.description
      ? `: ${post.data.description.trim().replace(/\n/g, ' ')}`
      : '';
    lines.push(`- [${post.data.title}](${postMdUrl(post.slug)}) (${date})${desc}`);
  }

  lines.push('');
  return lines.join('\n');
}
