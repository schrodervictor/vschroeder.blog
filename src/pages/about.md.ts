import type { APIRoute } from 'astro';
import { mdResponse } from '../lib/markdown-feed';
import { stripFrontmatter } from '../lib/markdown-feed';
import aboutRaw from './about.md?raw';

const body = stripFrontmatter(aboutRaw);

export const GET: APIRoute = async () => {
  const lines = [
    '**Blog:** [vschroeder.blog](https://vschroeder.blog)',
    '',
    '[View as HTML](/about/) | [Posts](/posts.md) | [Tags](/tags.md)',
    '',
    '---',
    '',
    body.trim(),
    '',
  ];

  return mdResponse(lines.join('\n'));
};
