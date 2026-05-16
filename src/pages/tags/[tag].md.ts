import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import {
  getNonDraftPosts, postsList, tagHtmlUrl, mdResponse,
} from '../../lib/markdown-feed';

export const getStaticPaths: GetStaticPaths = async () => {
  const allPosts = (await getCollection('posts'))
    .filter(post => !post.data.draft);

  const uniqueTags = [...new Set(allPosts.flatMap(post => post.data.tags))];

  return uniqueTags.map(tag => {
    const filtered = getNonDraftPosts(
      allPosts.filter(post => post.data.tags.includes(tag))
    );
    return {
      params: { tag },
      props: { posts: filtered },
    };
  });
};

export const GET: APIRoute = async ({ params, props }) => {
  const { tag } = params;
  const { posts } = props;

  const lines = [
    `# Posts tagged: ${tag}`,
    '',
    `[View as HTML](${tagHtmlUrl(tag!)}) | [All tags](/tags.md) | [All posts](/posts.md)`,
    '',
    postsList(posts),
    '',
  ];

  return mdResponse(lines.join('\n'));
};
