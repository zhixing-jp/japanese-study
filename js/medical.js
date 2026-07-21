/* ══════════════════════════════
   medical.js — 就医指南版块
   Living Japanese v3.0
══════════════════════════════ */
window.LJ_MODULES = window.LJ_MODULES || {};
window.LJ_MODULES['medical'] = {
  init: async function(cfg, icons){
    document.getElementById('panel-medical').innerHTML = `
      <div class="ph">
        <div class="ph-icon">🏥</div>
        <div class="ph-title">日本就医流程指南</div>
        <div class="ph-desc">
          从找医院到取药，<br>
          图文并茂一步一步带你走。<br>
          2026实用版，专为在日华人设计。
        </div>
        <span class="ph-badge">即将上线</span>
      </div>`;
  }
};
