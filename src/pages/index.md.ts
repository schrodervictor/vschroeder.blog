import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  formatDate, postMdUrl, tagMdUrl, getNonDraftPosts, mdResponse,
} from '../lib/content-helpers';

export const GET: APIRoute = async () => {
  const posts = getNonDraftPosts(await getCollection('posts'));

  const lines = [
    '# vschroeder.blog',
    '',
    'Code, AI, Linux, Metal and more.',
    '',
    '[Posts](/posts.md) | [Tags](/tags.md) | [About](/about.md)',
    '',
    '---',
    '',
  ];

  for (const post of posts) {
    const date = formatDate(post.data.pubDate);
    const tags = post.data.tags
      .map((t: string) => `[${t}](${tagMdUrl(t)})`)
      .join(', ');

    lines.push(
      `## [${post.data.title}](${postMdUrl(post.slug)})`,
      '',
      `${date} | ${tags}`,
      '',
    );

    if (post.data.description) {
      lines.push(post.data.description.trim(), '');
    }
  }

  return mdResponse(lines.join('\n'));
};
