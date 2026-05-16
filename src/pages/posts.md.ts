import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getNonDraftPosts, postsList, mdResponse } from '../lib/markdown-feed';

export const GET: APIRoute = async () => {
  const posts = getNonDraftPosts(await getCollection('posts'));

  const lines = [
    '# vschroeder.blog — Posts',
    '',
    '[View as HTML](/posts/) | [Tags](/tags.md) | [About](/about.md)',
    '',
    postsList(posts),
    '',
  ];

  return mdResponse(lines.join('\n'));
};
