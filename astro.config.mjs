import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://livingjapanese.app',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'zh-TW', 'en', 'vi', 'ko', 'ja'],
    routing: {
      prefixDefaultLocale: false,
      strategy: 'pathname'
    }
  }
});