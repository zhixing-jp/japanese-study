/* ══════════════════════════════
   medical-ui.js — 就医指南板块专属交互逻辑
   独立系统：不调用/不依赖 rescue-ui.js
   浏览器朗读能力依赖公共基础层 tts-core.js（站点级，rescue也可复用，
   但两个版块的业务逻辑互不感知、互不调用）
   Living Japanese v4.0 SSG
══════════════════════════════ */

(function () {
  'use strict';

  /* ────────────────────────────────
     一、TTS 播放（调用公共层 tts-core.js，
        medical 只负责"按 type 字段判断该不该读"这层业务逻辑）
  ──────────────────────────────── */

  /**
   * 播放单条内容。按 type 字段判断是否朗读：
   * - phrase / dialogue_turn → 朗读 jp 字段
   * - instruction → 不朗读，仅展示文字
   */
  function medSpeakItem(item) {
    if (!item || item.type === 'instruction') return;
    if (!item.jp) return;
    if (!window.ttsCore) return;

    window.ttsCore.speak(item.jp, { lang: 'ja-JP' });
  }

  /**
   * 按顺序连续播放一组条目，跳过 type === 'instruction' 的条目。
   */
  function medSpeakList(items) {
    if (!window.ttsCore) return;

    const playable = (items || []).filter(function (item) {
      return item.type !== 'instruction' && item.jp;
    });

    window.ttsCore.speakQueue(
      playable.map(function (item) { return { text: item.jp, lang: 'ja-JP' }; })
    );
  }

  function medStopSpeaking() {
    if (window.ttsCore) window.ttsCore.stop();
  }

  /* ────────────────────────────────
     二、症状词库：搜索与筛选
  ──────────────────────────────── */

  /**
   * 在 body_parts 数据里搜索匹配的词条（按 symptom_jp / example_zh 等字段模糊匹配）。
   * 返回扁平化的 entries 数组。
   */
  function medSearchSymptoms(bodyParts, keyword) {
    if (!keyword) return [];
    const kw = keyword.trim().toLowerCase();
    const results = [];

    bodyParts.forEach(function (part) {
      part.groups.forEach(function (group) {
        group.entries.forEach(function (entry) {
          const haystack = [
            entry.symptom_jp,
            entry.example_jp,
            entry.example_zh
          ].join(' ').toLowerCase();
          if (haystack.indexOf(kw) !== -1) {
            results.push(entry);
          }
        });
      });
    });

    return results;
  }

  /**
   * 根据 related_entries 字段，取出某条目关联的近义词条，用于并排对比展示。
   */
  function medGetRelatedEntries(bodyParts, entry) {
    if (!entry.related_entries || !entry.related_entries.length) return [];

    const allEntries = [];
    bodyParts.forEach(function (part) {
      part.groups.forEach(function (group) {
        group.entries.forEach(function (e) {
          allEntries.push(e);
        });
      });
    });

    return entry.related_entries
      .map(function (id) {
        return allEntries.filter(function (e) { return e.id === id; })[0];
      })
      .filter(Boolean);
  }

  /* ────────────────────────────────
     三、危险信号提示
  ──────────────────────────────── */

  /**
   * 词条跟读完成后调用：若 danger_flag 为 true，触发提示条，
   * 指向"叫救护车完整指南"页（内部链接，非导流广告）。
   * 文案强度按 danger_severity 分三档，避免把低频罕见信号和
   * 真正分秒必争的信号用同一种紧迫语气展示。
   */
  const DANGER_TIP_TEXT = {
    critical: '这种情况可能危及生命，建议立即拨打119或前往急诊。',
    urgent: '这种情况建议尽快就医确认，不必惊慌但也不要拖延。',
    rare_but_serious: '这种情况比较少见，但如果符合描述，建议就医时主动告知医生。'
  };

  function medShowDangerTip(entry, containerEl) {
    if (!entry || !entry.danger_flag) return;
    if (!containerEl) return;

    const severity = entry.danger_severity || 'urgent';
    const text = DANGER_TIP_TEXT[severity] || DANGER_TIP_TEXT.urgent;
    const severityClass = severity === 'critical' ? '' : (severity === 'rare_but_serious' ? 'is-rare' : 'is-urgent');

    const tip = document.createElement('div');
    tip.className = 'med-symptom-danger-tip' + (severityClass ? ' ' + severityClass : '');
    tip.innerHTML = text + '<a href="/medical/calling-ambulance/">查看叫救护车指南 →</a>';
    containerEl.appendChild(tip);
  }

  /* ────────────────────────────────
     四、导出到全局，供各 .astro 页面内联脚本调用
  ──────────────────────────────── */

  window.medicalUI = {
    speakItem: medSpeakItem,
    speakList: medSpeakList,
    stopSpeaking: medStopSpeaking,
    searchSymptoms: medSearchSymptoms,
    getRelatedEntries: medGetRelatedEntries,
    showDangerTip: medShowDangerTip
  };
})();
