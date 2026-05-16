import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getNonDraftPosts, renderLlmsTxt, mdResponse } from '../lib/content-helpers';

export const GET: APIRoute = async () => {
  const posts = getNonDraftPosts(await getCollection('posts'));
  return mdResponse(renderLlmsTxt(posts));
};
