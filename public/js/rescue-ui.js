/* ══════════════════════════════
   rescue-ui.js
   Living Japanese v4.0 SSG
   职责：rescue版块交互功能
   依赖：base.js（jaVoice/zhVoice/currentLang）
   不包含：任何HTML渲染
══════════════════════════════ */

/* ── 状态 ── */
let currentMode = localStorage.getItem('lj_mode') || 'jp';
let currentRate = parseFloat(localStorage.getItem('lj_rate') || '0.75');
let playMode = localStorage.getItem('lj_playmode') || 'continuous'; // 'continuous' | 'follow3' | 'follow5'
let shouldStop = false;
let loopMode = false;
let speakSession = 0;

/* ── 读取静态HTML中的句子数据 ── */
function getItems() {
  return Array.from(document.querySelectorAll('.card')).map((el, idx) => ({
    idx,
    jp: el.dataset.furigana || el.dataset.jp || '',
    text: el.dataset.text || '',
    role: el.dataset.role || 'user'
  }));
}

/* ── 朗读单句 ── */
function speakItem(idx) {
  const items = getItems();
  const item = items[idx];
  if (!item) return;
  shouldStop = false;
  speakSession++;
  hlCard(idx);
  speakSegs(getModeSegs(item), speakSession);
}

/* ── 朗读全部（user + staff，按页面实际顺序）── */
function speakAll() {
  shouldStop = false;
  speakSession++;
  const session = speakSession;
  const items = getItems();
  if (!items.length) { showToast('🎉 全部已学完！'); return; }
  speakList(items, 0, session);
}

/* ── 跟读间隔（ms），由playMode决定 ── */
function getPlayInterval() {
  if (playMode === 'follow3') return 3000;
  if (playMode === 'follow5') return 5000;
  return 450; // continuous：维持原有连读体验
}

function speakList(list, idx, session) {
  if (shouldStop || speakSession !== session) return;
  if (idx >= list.length) {
    document.querySelectorAll('.card.playing').forEach(el => el.classList.remove('playing'));
    if (loopMode) {
      setTimeout(() => { if (!shouldStop && speakSession === session) speakList(list, 0, session); }, 800);
    } else {
      isPlaying = false;
      const btn = document.getElementById('btnPlay');
      if (btn) btn.textContent = '▶';
      showToast('✓ 朗读完毕');
    }
    return;
  }
  const item = list[idx];
  hlCard(item.idx);
  speakSegs(getModeSegs(item), session, () => {
    setTimeout(() => speakList(list, idx + 1, session), getPlayInterval());
  });
}

/* ── 朗读模式 ── */
function getModeSegs(item) {
  const langMap = {
    zh: 'zh-CN', 'zh-TW': 'zh-TW', en: 'en-US', vi: 'vi-VN', ko: 'ko-KR'
  };
  const pageLang = document.getElementById('pageData')?.dataset.lang || 'zh';
  const ttsLang = langMap[pageLang] || 'zh-CN';
  if (currentMode === 'jp') return [{ t: item.jp, l: 'ja-JP', v: jaVoice }];
  if (currentMode === 'jp_zh') return [
    { t: item.jp, l: 'ja-JP', v: jaVoice },
    { t: item.text, l: ttsLang, v: zhVoice }
  ];
  return [
    { t: item.jp, l: 'ja-JP', v: jaVoice },
    { t: item.text, l: ttsLang, v: zhVoice },
    { t: item.jp, l: 'ja-JP', v: jaVoice }
  ];
}

function speakSegs(segs, session, onEnd) {
  window.speechSynthesis.cancel();
  setTimeout(() => {
    let i = 0;
    function next() {
      if (shouldStop || speakSession !== session) return;
      if (i >= segs.length) { if (onEnd) onEnd(); return; }
      const sg = segs[i++];
      const u = new SpeechSynthesisUtterance(sg.t);
      u.lang = sg.l; u.rate = currentRate; u.pitch = 1;
      if (sg.v) u.voice = sg.v;
      u.onend = () => setTimeout(next, 350);
      u.onerror = () => setTimeout(next, 100);
      window.speechSynthesis.speak(u);
    }
    next();
  }, 80);
}

/* ── 停止朗读 ── */
function stopRescueSpeech() {
  shouldStop = true;
  speakSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.card.playing').forEach(el => el.classList.remove('playing'));
}

/* ── 高亮卡片 ── */
function hlCard(idx) {
  document.querySelectorAll('.card.playing').forEach(el => el.classList.remove('playing'));
  const el = document.getElementById(`card-${idx}`);
  if (el) { el.classList.add('playing'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

/* ── 学会了标记 ── */
function getChecked(sceneId) {
  try { return JSON.parse(localStorage.getItem(`lj_checked_${sceneId}`) || '{}'); }
  catch(e) { return {}; }
}

function saveChecked(sceneId, checked) {
  try { localStorage.setItem(`lj_checked_${sceneId}`, JSON.stringify(checked)); }
  catch(e) {}
}


/* ── 模式/速度/朗读方式切换 ── */
function setMode(mode) { currentMode = mode; localStorage.setItem('lj_mode', mode); }
function setRate(rate) { currentRate = parseFloat(rate); localStorage.setItem('lj_rate', rate); }

/* 跟读/连读模式切换
   value: 'continuous' | 'follow3' | 'follow5' */
function toggleFollow(mode) {
  playMode = mode;
  localStorage.setItem('lj_playmode', mode);
}

/* ══════════════════════════════
   ctrlbar 循环按钮（替代原下拉框）
   固定宽度符号，不受语言文本长度影响，避免溢出
══════════════════════════════ */
const PLAY_MODE_ORDER = ['continuous', 'follow3', 'follow5'];
const PLAY_MODE_LABEL = { continuous: '▶●▶', follow3: '⏸ 3s', follow5: '⏸ 5s' };

const READ_MODE_ORDER = ['jp', 'jp_zh', 'repeat'];
function readModeLabel(mode) {
  const l2 = document.getElementById('pageData')?.dataset.l2Code || 'ZH';
  if (mode === 'jp') return 'JA';
  if (mode === 'jp_zh') return `JA+${l2}`;
  return `JA+${l2}+JA`;
}

const RATE_ORDER = ['0.9', '0.75', '0.6'];
function rateLabel(rate) { return `x${rate}`; }

function renderCycleButtons() {
  const btnPlayMode = document.getElementById('btnPlayMode');
  const btnMode = document.getElementById('btnMode');
  const btnRate = document.getElementById('btnRate');
  if (btnPlayMode) btnPlayMode.textContent = PLAY_MODE_LABEL[playMode] || PLAY_MODE_LABEL.continuous;
  if (btnMode) btnMode.textContent = readModeLabel(currentMode);
  if (btnRate) btnRate.textContent = rateLabel(String(currentRate));
}

function cyclePlayMode() {
  const i = PLAY_MODE_ORDER.indexOf(playMode);
  playMode = PLAY_MODE_ORDER[(i + 1) % PLAY_MODE_ORDER.length];
  localStorage.setItem('lj_playmode', playMode);
  renderCycleButtons();
}

function cycleMode() {
  const i = READ_MODE_ORDER.indexOf(currentMode);
  currentMode = READ_MODE_ORDER[(i + 1) % READ_MODE_ORDER.length];
  localStorage.setItem('lj_mode', currentMode);
  renderCycleButtons();
}

function cycleRate() {
  const i = RATE_ORDER.indexOf(String(currentRate));
  const next = RATE_ORDER[(i + 1) % RATE_ORDER.length];
  currentRate = parseFloat(next);
  localStorage.setItem('lj_rate', next);
  renderCycleButtons();
}

/* ── 初始化 ── */
document.addEventListener('DOMContentLoaded', () => {
  const sceneId = document.getElementById('pageData')?.dataset.sceneId;
  if (sceneId) {
    const checked = getChecked(sceneId);
    Object.keys(checked).forEach(idx => {
      if (checked[idx]) {
        document.getElementById(`card-${idx}`)?.classList.add('done');
        document.getElementById(`lb-${idx}`)?.classList.add('on');
      }
    });
  }
  renderCycleButtons();
});
let isPlaying = false;

function togglePlay() {
  const btn = document.getElementById('btnPlay');
  if (isPlaying) {
    stopRescueSpeech();
    isPlaying = false;
    if (btn) btn.textContent = '▶';
  } else {
    isPlaying = true;
    if (btn) btn.textContent = '■';
    speakAll();
  }
}

function toggleLoop() {
  loopMode = !loopMode;
  document.getElementById('btnLoop')?.classList.toggle('on', loopMode);
}

function toggleRuby() {
  document.body.classList.toggle('no-ruby');
  document.getElementById('btnRuby')?.classList.toggle('on');
}