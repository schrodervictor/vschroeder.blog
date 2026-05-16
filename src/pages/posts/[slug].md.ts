import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import {
  getNonDraftPosts, mdResponse, renderPostMarkdown,
} from '../../lib/content-helpers';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getNonDraftPosts(await getCollection('posts'));

  return posts.map((post, index) => ({
    params: { slug: post.slug },
    props: {
      post,
      prevPost: index < posts.length - 1 ? posts[index + 1] : null,
      nextPost: index > 0 ? posts[index - 1] : null,
    },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post, prevPost, nextPost } = props;
  return mdResponse(renderPostMarkdown(post, prevPost, nextPost));
};
