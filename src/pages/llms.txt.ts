import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { formatDate, postMdUrl, getNonDraftPosts } from '../lib/content-helpers';

export const GET: APIRoute = async () => {
  const posts = getNonDraftPosts(await getCollection('posts'));

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
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
