import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 注：本项目的多语言路由是靠 src/pages/[lang]/ 下每个页面自己的 getStaticPaths()
// 手动实现的（配合 src/i18n/index.js 的 getLangFromUrl 等辅助函数），并没有使用
// Astro 内置的 i18n 路由 API（astro:i18n / Astro.currentLocale / getRelativeLocaleUrl）。
// 之前这里同时配置了 Astro 内置的 i18n.routing，会让 Astro 引擎自己也介入 /en/ /ja/
// 这类路径的路由解析，和手写的 [lang] 路由是两套互不知情、并行生效的机制，
// dev 模式下可能造成路由状态混淆（同一路径不同请求返回内容不一致）。
// 由于项目实际上没有使用任何内置 i18n API，这段配置本身是无用的历史遗留，直接移除。
export default defineConfig({
  site: 'https://livingjapanese.app',
  integrations: [sitemap()]
});