/* ══════════════════════════════
   community.js — 社区版块
   Living Japanese v3.0
══════════════════════════════ */
window.LJ_MODULES = window.LJ_MODULES || {};
window.LJ_MODULES['community'] = {
  init: async function(cfg, icons){
    document.getElementById('panel-community').innerHTML = `
      <div class="ph">
        <div class="ph-icon">💬</div>
        <div class="ph-title">在日华人社区</div>
        <div class="ph-desc">
          分享经验，互相帮助。<br>
          在日生活遇到的问题，<br>
          这里都有人懂你。
        </div>
        <span class="ph-badge">敬请期待</span>
      </div>`;
  }
};
