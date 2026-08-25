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
  if (path.startsWith('/ja/'))    return 'ja';
  const saved = localStorage.getItem('lj_lang');
  if (saved) return saved;
  const sys = (navigator.language || 'en').toLowerCase();
  if (sys.startsWith('zh-tw') || sys.startsWith('zh-hk')) return 'zh-TW';
  if (sys.startsWith('zh')) return 'zh';
  if (sys.startsWith('vi')) return 'vi';
  if (sys.startsWith('ko')) return 'ko';
  if (sys.startsWith('ja')) return 'ja';
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
    'en': '/en/', 'vi': '/vi/', 'ko': '/ko/', 'ja': '/ja/'
  };
  const path = window.location.pathname;
  const subMatch = path.match(/\/rescue\/(s\d+)\/(sub\d+)\//);
  const sceneMatch = path.match(/\/rescue\/(s\d+)\//);
  // /medical/ 整个家族（就医指南首页、8个分类子页面、症状指认词库列表页与详情页）
  // 都是构建时按语言各自生成好的独立静态页面（中文版无前缀，其他语言版有 /lang/ 前缀），
  // 不是客户端动态换语言的页面，所以切换语言要跳转到"同一子路径对应语言版本"，
  // 而不是走 loadLocale() 原地刷新那一套（那一套只适用于 about 这种单一路径页面）。
  const medicalMatch = path.match(/^(?:\/(?:zh-TW|en|vi|ko|ja))?\/medical(\/.*)?\/?$/);
  // career 同 medical，[lang]/career/* 目录已按语言各自生成静态页面，
  // 切换语言时跳转到"同一子路径对应语言版本"，而不是原地刷新。
  const careerMatch = path.match(/^(?:\/(?:zh-TW|en|vi|ko|ja))?\/career(\/.*)?\/?$/);
  // about 是单一路径（无语言子目录），页面内容按 currentLang 在客户端动态显示，
  // 不需要跳转页面——只需重新 loadLocale 并重新渲染，原地刷新即可
  const singlePathMatch = path.match(/^\/(about)\/?$/);
  if (subMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    window.location.href = `${prefix}/rescue/${subMatch[1]}/${subMatch[2]}/`;
  } else if (sceneMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    window.location.href = `${prefix}/rescue/${sceneMatch[1]}/`;
  } else if (medicalMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    const subPath = medicalMatch[1] || '/';
    window.location.href = `${prefix}/medical${subPath}`;
  } else if (careerMatch) {
    const prefix = langPaths[lang] === '/' ? '' : langPaths[lang].slice(0, -1);
    const subPath = careerMatch[1] || '/';
    window.location.href = `${prefix}/career${subPath}`;
  } else if (singlePathMatch) {
    loadLocale(lang).then(() => {
      document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
    });
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