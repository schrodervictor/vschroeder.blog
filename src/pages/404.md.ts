import type { APIRoute } from 'astro';
import { mdResponse } from '../lib/content-helpers';

export const GET: APIRoute = async () => {
  const lines = [
    '# 404 — Page not found',
    '',
    '**Blog:** [vschroeder.blog](https://vschroeder.blog)',
    '',
    'This page doesn\'t exist.',
    '',
    '- [All posts](/posts.md)',
    '- [All tags](/tags.md)',
    '- [About](/about.md)',
    '',
  ];

  return mdResponse(lines.join('\n'));
};
