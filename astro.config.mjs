// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://vschroeder.blog',
  base: '/',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      langs: [],
      wrap: false,
    },
  },
});
