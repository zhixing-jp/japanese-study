/* ══════════════════════════════
   base.js — 全局共用函数
   Living Japanese v4.0 SSG
   职责：语言/工具函数/语音初始化
   不包含：任何HTML渲染/模块加载
══════════════════════════════ */

/* ── i18n ── */
let currentLang = 'zh';
let LOCALE = {};

function detectLang() {
  const path = window.location.pathname;
  if (path.startsWith('/en/'))    return 'en';
  if (path.startsWith('/zh-TW/')) return 'zh-TW';
  if (path.startsWith('/vi/'))    return 'vi';
  if (path.startsWith('/ko/'))    return 'ko';
  const saved = localStorage.getItem('lj_lang');
  if (saved) return saved;
  const sys = (navigator.language || 'en').toLowerCase();
  if (sys.startsWith('zh-tw') || sys.startsWith('zh-hk')) return 'zh-TW';
  if (sys.startsWith('zh')) return 'zh';
  if (sys.startsWith('vi')) return 'vi';
  if (sys.startsWith('ko')) return 'ko';
  return 'en';
}

async function loadLocale(lang) {
  try {
    LOCALE = await fetch(`/locales/${lang}.json`).then(r => r.json());
    currentLang = lang;
    document.documentElement.lang = lang;
  } catch(e) {
    LOCALE = await fetch('/locales/zh.json').then(r => r.json());
    currentLang = 'zh';
  }
}

function t(key) {
  return LOCALE[key] || key;
}

function switchLang(lang) {
  localStorage.setItem('lj_lang', lang);
  const langPaths = {
    'zh': '/', 'zh-TW': '/zh-TW/',
    'en': '/en/', 'vi': '/vi/', 'ko': '/ko/'
  };
  const path = window.location.pathname;
  const subMatch = path.match(/\/rescue\/(s\d+)\/(sub\d+)\//);
  const sceneMatch = path.match(/\/rescue\/(s\d+)\//);
  if (subMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    window.location.href = `${prefix}/rescue/${subMatch[1]}/${subMatch[2]}/`;
  } else if (sceneMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    window.location.href = `${prefix}/rescue/${sceneMatch[1]}/`;
  } else {
    window.location.href = langPaths[lang] || '/';
  }
}

/* ── HTML转义 ── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
  );
}

/* ── Toast ── */
let _tt = null;
function showToast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('on'), ms);
}

/* ── 语音（全局共享，rescue-ui.js直接使用）── */
var jaVoice = null;
var zhVoice = null;

function initVoices() {
  function find() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    for (const n of ['Kyoko', 'Otoya', 'O-ren', 'Hattori']) {
      jaVoice = voices.find(x => x.name.includes(n) && x.lang.startsWith('ja'));
      if (jaVoice) break;
    }
    if (!jaVoice) jaVoice = voices.find(x => x.lang.startsWith('ja')) || null;
    for (const n of ['Ting-Ting', 'Sin-ji', 'Mei-Jia', 'Tian-Tian']) {
      zhVoice = voices.find(x => x.name.includes(n));
      if (zhVoice) break;
    }
    if (!zhVoice) zhVoice = voices.find(x => x.lang.startsWith('zh')) || null;
  }
  find();
  window.speechSynthesis.onvoiceschanged = find;
}

/* ── 页面加载时初始化 ── */
document.addEventListener('DOMContentLoaded', async () => {
  const lang = detectLang();
  await loadLocale(lang);
  initVoices();

  // 回到顶部按钮
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('backTop');
    if (btn) btn.classList.toggle('on', window.scrollY > 300);
  });

  // 页面隐藏时暂停朗读
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.speechSynthesis.pause();
  });
});