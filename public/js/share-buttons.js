/* ══════════════════════════════
   share-buttons.js — 内容页通用分享按钮
   Living Japanese v4.0 SSG

   用于career文章页、medical内容分类页/症状词库这类"免费内容页"，
   不用于guides商品页（guides页面自己的分享逻辑独立维护在guides/index.astro里，
   因为它涉及商品维度的GA事件参数，不套用这套通用逻辑，避免两边互相牵连）。

   用法：页面里放一个容器 <div id="shareButtonsMount"></div>，
   再引入本脚本 + 一段 define:vars 传入当前页面的分享文案，即可渲染出
   LINE / WhatsApp / 微信（复制链接）三个按钮，点击后跳转对应分享面板
   或复制链接到剪贴板。不依赖任何账号/数据库，纯前端。

   依赖的挂载点数据（通过 window.ljShareData 传入，见各页面script标签）：
   {
     mountId: 'shareButtonsMount',   // 容器元素id，默认'shareButtonsMount'
     text: '这篇讲得挺实在：{标题}',  // 分享文案模板（已经拼好标题的最终文案）
     labels: {
       line: 'LINE分享', whatsapp: 'WhatsApp分享', wechat: '微信分享（复制链接）',
       wechatCopied: '链接已复制，去微信里粘贴发送吧'
     },
     gaEvent: 'content_share_click'  // GA事件名，不同版块可以传不同的名字方便区分
   }
══════════════════════════════ */
(function () {
  function renderShareButtons(config) {
    const mount = document.getElementById(config.mountId || 'shareButtonsMount');
    if (!mount) return;

    const labels = config.labels || {};
    mount.innerHTML =
      '<a class="guides-share-btn" data-share="line" href="#" target="_blank" rel="noopener">' + (labels.line || 'LINE') + '</a>' +
      '<a class="guides-share-btn" data-share="whatsapp" href="#" target="_blank" rel="noopener">' + (labels.whatsapp || 'WhatsApp') + '</a>' +
      '<button type="button" class="guides-share-btn" data-share="wechat">' + (labels.wechat || 'WeChat') + '</button>';

    const shareUrl = window.location.href;
    const shareText = config.text || document.title;
    const gaEvent = config.gaEvent || 'content_share_click';

    function fireGa(channel) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', gaEvent, { channel: channel, page_path: window.location.pathname });
      }
    }

    const lineBtn = mount.querySelector('[data-share="line"]');
    if (lineBtn) {
      lineBtn.href = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent(shareText);
      lineBtn.addEventListener('click', function () { fireGa('line'); });
    }

    const waBtn = mount.querySelector('[data-share="whatsapp"]');
    if (waBtn) {
      waBtn.href = 'https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + shareUrl);
      waBtn.addEventListener('click', function () { fireGa('whatsapp'); });
    }

    const wechatBtn = mount.querySelector('[data-share="wechat"]');
    if (wechatBtn) {
      wechatBtn.addEventListener('click', function () {
        fireGa('wechat');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            const original = labels.wechat || 'WeChat';
            wechatBtn.textContent = labels.wechatCopied || '链接已复制';
            setTimeout(function () { wechatBtn.textContent = original; }, 3000);
          });
        }
      });
    }
  }

  function init() {
    if (window.ljShareData) renderShareButtons(window.ljShareData);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
