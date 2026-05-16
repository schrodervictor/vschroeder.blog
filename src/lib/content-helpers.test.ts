import { describe, it, expect } from 'vitest';
import {
  formatDate,
  postMdUrl,
  postHtmlUrl,
  tagMdUrl,
  tagHtmlUrl,
  mdResponse,
  getNonDraftPosts,
  postsList,
  stripFrontmatter,
  deriveMdUrl,
  renderPostMarkdown,
  countTags,
} from './content-helpers';

function fakePost(overrides: {
  slug?: string;
  title?: string;
  description?: string;
  pubDate?: Date;
  updatedDate?: Date;
  author?: string;
  tags?: string[];
  draft?: boolean;
  body?: string;
}) {
  return {
    slug: overrides.slug ?? 'test-post',
    body: overrides.body ?? '',
    data: {
      title: overrides.title ?? 'Test Post',
      description: overrides.description,
      pubDate: overrides.pubDate ?? new Date('2026-05-10'),
      updatedDate: overrides.updatedDate,
      author: overrides.author,
      draft: overrides.draft ?? false,
      tags: overrides.tags ?? [],
    },
  } as any;
}

describe('formatDate', () => {
  it('returns ISO date string', () => {
    expect(formatDate(new Date('2026-05-10T14:30:00Z'))).toBe('2026-05-10');
  });

  it('handles midnight UTC', () => {
    expect(formatDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });
});

describe('URL helpers', () => {
  it('postMdUrl appends .md', () => {
    expect(postMdUrl('my-post')).toBe('/posts/my-post.md');
  });

  it('postHtmlUrl appends trailing slash', () => {
    expect(postHtmlUrl('my-post')).toBe('/posts/my-post/');
  });

  it('tagMdUrl appends .md', () => {
    expect(tagMdUrl('ai')).toBe('/tags/ai.md');
  });

  it('tagHtmlUrl appends trailing slash', () => {
    expect(tagHtmlUrl('ai')).toBe('/tags/ai/');
  });

  it('handles slugs with dates', () => {
    expect(postMdUrl('20260510-ai-is-not-your-new-terminal'))
      .toBe('/posts/20260510-ai-is-not-your-new-terminal.md');
  });

  it('handles tags with spaces', () => {
    expect(tagMdUrl('good practices')).toBe('/tags/good practices.md');
  });
});

describe('mdResponse', () => {
  it('returns a Response with markdown content type', async () => {
    const res = mdResponse('# Hello');
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(await res.text()).toBe('# Hello');
  });
});

describe('getNonDraftPosts', () => {
  it('filters out drafts', () => {
    const posts = [
      fakePost({ slug: 'published', draft: false }),
      fakePost({ slug: 'draft', draft: true }),
    ];
    const result = getNonDraftPosts(posts);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('published');
  });

  it('sorts by pubDate descending', () => {
    const posts = [
      fakePost({ slug: 'older', pubDate: new Date('2026-01-01') }),
      fakePost({ slug: 'newer', pubDate: new Date('2026-05-10') }),
      fakePost({ slug: 'middle', pubDate: new Date('2026-03-15') }),
    ];
    const result = getNonDraftPosts(posts);
    expect(result.map(p => p.slug)).toEqual(['newer', 'middle', 'older']);
  });

  it('returns empty array when all posts are drafts', () => {
    const posts = [
      fakePost({ draft: true }),
      fakePost({ draft: true }),
    ];
    expect(getNonDraftPosts(posts)).toEqual([]);
  });
});

describe('postsList', () => {
  it('generates markdown list with dates and links', () => {
    const posts = [
      fakePost({
        slug: '20260510-first',
        title: 'First Post',
        pubDate: new Date('2026-05-10'),
      }),
      fakePost({
        slug: '20260405-second',
        title: 'Second Post',
        pubDate: new Date('2026-04-05'),
      }),
    ];
    expect(postsList(posts)).toBe(
      '- 2026-05-10 [First Post](/posts/20260510-first.md)\n' +
      '- 2026-04-05 [Second Post](/posts/20260405-second.md)'
    );
  });

  it('returns empty string for empty array', () => {
    expect(postsList([])).toBe('');
  });
});

describe('stripFrontmatter', () => {
  it('removes YAML frontmatter', () => {
    const raw = '---\ntitle: Hello\ntags: [a]\n---\n\n# Content here';
    expect(stripFrontmatter(raw)).toBe('# Content here');
  });

  it('returns content unchanged when no frontmatter', () => {
    const raw = '# Just content';
    expect(stripFrontmatter(raw)).toBe('# Just content');
  });

  it('handles multiline description in frontmatter', () => {
    const raw = '---\ntitle: Hello\ndescription: >\n  Long\n  description\n---\n\nBody';
    expect(stripFrontmatter(raw)).toBe('Body');
  });
});

describe('deriveMdUrl', () => {
  it('converts root path to /index.md', () => {
    expect(deriveMdUrl('/')).toBe('/index.md');
  });

  it('converts empty string to /index.md', () => {
    expect(deriveMdUrl('')).toBe('/index.md');
  });

  it('appends .md to post path with trailing slash', () => {
    expect(deriveMdUrl('/posts/my-post/')).toBe('/posts/my-post.md');
  });

  it('appends .md to post path without trailing slash', () => {
    expect(deriveMdUrl('/posts/my-post')).toBe('/posts/my-post.md');
  });

  it('appends .md to tags path', () => {
    expect(deriveMdUrl('/tags/')).toBe('/tags.md');
  });

  it('appends .md to about path', () => {
    expect(deriveMdUrl('/about/')).toBe('/about.md');
  });
});

describe('countTags', () => {
  it('counts tags across posts', () => {
    const posts = [
      fakePost({ tags: ['ai', 'python'] }),
      fakePost({ tags: ['ai', 'linux'] }),
      fakePost({ tags: ['python'] }),
    ];
    expect(countTags(posts)).toEqual({
      ai: 2,
      python: 2,
      linux: 1,
    });
  });

  it('returns empty object for no posts', () => {
    expect(countTags([])).toEqual({});
  });

  it('returns empty object for posts with no tags', () => {
    const posts = [fakePost({ tags: [] })];
    expect(countTags(posts)).toEqual({});
  });
});

describe('renderPostMarkdown', () => {
  it('renders title as h1', () => {
    const post = fakePost({ title: 'My Great Post' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toMatch(/^# My Great Post\n/);
  });

  it('includes blog link and author', () => {
    const post = fakePost({ author: 'Victor Schroeder' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('**Blog:** [vschroeder.blog]');
    expect(result).toContain('**Author:** Victor Schroeder');
  });

  it('defaults author to Victor Schroeder', () => {
    const post = fakePost({});
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('**Author:** Victor Schroeder');
  });

  it('includes publish date', () => {
    const post = fakePost({ pubDate: new Date('2026-05-10') });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('**Published:** 2026-05-10');
  });

  it('includes updated date when present', () => {
    const post = fakePost({
      pubDate: new Date('2026-05-10'),
      updatedDate: new Date('2026-05-15'),
    });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('**Updated:** 2026-05-15');
  });

  it('omits updated date when absent', () => {
    const post = fakePost({});
    const result = renderPostMarkdown(post, null, null);
    expect(result).not.toContain('**Updated:**');
  });

  it('renders tags as markdown links', () => {
    const post = fakePost({ tags: ['ai', 'python'] });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('**Tags:** [ai](/tags/ai.md), [python](/tags/python.md)');
  });

  it('omits tags line when no tags', () => {
    const post = fakePost({ tags: [] });
    const result = renderPostMarkdown(post, null, null);
    expect(result).not.toContain('**Tags:**');
  });

  it('renders description as blockquote', () => {
    const post = fakePost({ description: 'A short summary.' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('> A short summary.');
  });

  it('omits description when absent', () => {
    const post = fakePost({});
    const result = renderPostMarkdown(post, null, null);
    expect(result).not.toContain('> ');
  });

  it('includes View as HTML link', () => {
    const post = fakePost({ slug: '20260510-my-post' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('[View as HTML](/posts/20260510-my-post/)');
  });

  it('includes post body', () => {
    const post = fakePost({ body: 'This is the **content**.' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).toContain('This is the **content**.');
  });

  it('renders previous and next navigation', () => {
    const post = fakePost({ slug: 'current' });
    const prev = fakePost({ slug: 'older-post', title: 'Older' });
    const next = fakePost({ slug: 'newer-post', title: 'Newer' });
    const result = renderPostMarkdown(post, prev, next);
    expect(result).toContain('Previous: [Older](/posts/older-post.md)');
    expect(result).toContain('Next: [Newer](/posts/newer-post.md)');
  });

  it('renders only previous when no next', () => {
    const post = fakePost({ slug: 'current' });
    const prev = fakePost({ slug: 'older', title: 'Older' });
    const result = renderPostMarkdown(post, prev, null);
    expect(result).toContain('Previous: [Older]');
    expect(result).not.toContain('Next:');
  });

  it('renders only next when no previous', () => {
    const post = fakePost({ slug: 'current' });
    const next = fakePost({ slug: 'newer', title: 'Newer' });
    const result = renderPostMarkdown(post, null, next);
    expect(result).not.toContain('Previous:');
    expect(result).toContain('Next: [Newer]');
  });

  it('omits navigation when no adjacent posts', () => {
    const post = fakePost({ slug: 'only-post' });
    const result = renderPostMarkdown(post, null, null);
    expect(result).not.toContain('Previous:');
    expect(result).not.toContain('Next:');
  });
});
