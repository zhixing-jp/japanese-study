/* ══════════════════════════════
   career-article-cta.js
   就职版块文章底部「了解更多」CTA卡片 —— 点击埋点
   Living Japanese v4.0 SSG

   之前这段逻辑在每篇文章页面里各自内联写了一遍（8份完全相同的<script>），
   统一收到这一个文件里，8篇文章共用同一份加载，以后新增文章不用再复制脚本。
══════════════════════════════ */

(function () {
  'use strict';

  function init() {
    var cta = document.querySelector('[data-ga-event="career_article_cta_click"]');
    if (!cta) return;
    cta.addEventListener('click', function () {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'career_article_cta_click', { page_path: window.location.pathname });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();