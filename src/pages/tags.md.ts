import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { tagMdUrl, mdResponse, countTags } from '../lib/content-helpers';

export const GET: APIRoute = async () => {
  const allPosts = (await getCollection('posts'))
    .filter(post => !post.data.draft);

  const tagCounts = countTags(allPosts);

  const sortedTags = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));

  const lines = [
    '# vschroeder.blog — Tags',
    '',
    '[View as HTML](/tags/) | [Posts](/posts.md) | [About](/about.md)',
    '',
  ];

  for (const tag of sortedTags) {
    lines.push(`- [${tag}](${tagMdUrl(tag)}) (${tagCounts[tag]} posts)`);
  }

  lines.push('');
  return mdResponse(lines.join('\n'));
};
