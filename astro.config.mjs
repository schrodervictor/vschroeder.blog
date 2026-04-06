// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import aptSource from './src/grammars/apt-source.json';
import aptList from './src/grammars/apt-list.json';

// https://astro.build/config
export default defineConfig({
  site: 'https://vschroeder.blog',
  base: '/',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      langs: [aptSource, aptList],
      wrap: false,
    },
  },
});
