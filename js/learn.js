/* ══════════════════════════════
   learn.js — 学习版块逻辑
   Living Japanese v3.0
══════════════════════════════ */

/* ── State ── */
let LEARN_INDEX = null;
let LEARN_CACHE = {};         // 已加载的场景数据缓存
let learnFamiliar = {};       // 已熟悉的场景 {id: true}
let currentScene = null;      // 当前场景数据
let currentDialog = [];       // 当前对话列表（基本或扩展）
let currentExtId = null;      // 当前扩展会话ID，null=基本
let learnShouldStop = false;
let learnSession = 0;
let learnLoopMode = false;

/* ── Web Audio API 音效 ── */
function playSound(type){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sounds = {
      conbini: [
        {freq:880, dur:.08, delay:0},
        {freq:1100, dur:.12, delay:.1}
      ],
      supermarket: [
        {freq:1200, dur:.06, delay:0}
      ],
      train: [
        {freq:440, dur:.08, delay:0},
        {freq:550, dur:.08, delay:.1},
        {freq:440, dur:.08, delay:.2},
        {freq:550, dur:.08, delay:.3}
      ]
    };
    const seq = sounds[type] || sounds.conbini;
    seq.forEach(s=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = s.freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + s.delay);
      gain.gain.linearRampToValueAtTime(.3, ctx.currentTime + s.delay + .01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + s.delay + s.dur);
      osc.start(ctx.currentTime + s.delay);
      osc.stop(ctx.currentTime + s.delay + s.dur + .05);
    });
  } catch(e){}
}

/* ── Boot ── */
async function learnBoot(){
  loadLearnStorage();
  try {
    LEARN_INDEX = await fetch('data/lessons/index.json').then(r=>r.json());
    renderLearnList();
  } catch(e){
    console.error('学习版块加载失败', e);
  }
}

/* ── Storage ── */
function loadLearnStorage(){
  try{ learnFamiliar=JSON.parse(localStorage.getItem('lj_familiar')||'{}'); }catch(e){ learnFamiliar={}; }
}
function saveLearnStorage(){
  try{ localStorage.setItem('lj_familiar',JSON.stringify(learnFamiliar)); }catch(e){}
}

/* ── 场景列表 ── */
function renderLearnList(){
  const wrap = document.getElementById('learnList');
  if(!wrap || !LEARN_INDEX) return;

  const levels = LEARN_INDEX.levels || [];
  const scenes = LEARN_INDEX.scenes || [];

  wrap.innerHTML = levels.map(lv=>{
    const lvScenes = scenes.filter(s=>s.level===lv.id);
    if(!lvScenes.length) return '';
    const stars = '★'.repeat(lv.star) + '☆'.repeat(5-lv.star);
    return `
      <div class="learn-level-group">
        <div class="learn-level-title">
          <span class="learn-level-stars">${stars}</span>
          ${esc(lv.label)} — ${esc(lv.desc)}
        </div>
        <div class="learn-scene-grid">
          ${lvScenes.map(sc=>renderSceneCard(sc)).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderSceneCard(sc){
  const isFamiliar  = !!learnFamiliar[sc.id];
  const isPracticed = !!learnFamiliar[sc.id+'_practiced'];
  let statusClass = '';
  let statusIcon  = '';
  if(isFamiliar)       { statusClass='familiar';  statusIcon='✓'; }
  else if(isPracticed) { statusClass='practiced'; statusIcon='●'; }

  return `
    <div class="learn-scene-card ${statusClass}" onclick="openScene('${sc.id}')">
      ${statusIcon?`<div class="learn-scene-status">${statusIcon}</div>`:''}
      <div class="learn-scene-emoji">${sc.emoji||'📖'}</div>
      <div class="learn-scene-title">${esc(sc.title)}</div>
    </div>`;
}

/* ── 打开场景 ── */
async function openScene(id){
  // 加载场景数据（优先走缓存）
  if(!LEARN_CACHE[id]){
    const sc = (LEARN_INDEX.scenes||[]).find(s=>s.id===id);
    if(!sc) return;
    try {
      LEARN_CACHE[id] = await fetch(sc.file).then(r=>r.json());
    } catch(e){
      showToast('场景加载失败', 2000); return;
    }
  }
  currentScene = LEARN_CACHE[id];
  currentExtId = null;

  // 切换视图
  document.getElementById('learnList').style.display = 'none';
  const detail = document.getElementById('learnDetail');
  detail.classList.add('on');
  document.getElementById('learnCtrlBar').classList.add('on');

  // 渲染详情页
  renderSceneDetail();

  // 入场音效
  playSound(currentScene.sound || 'conbini');
}

function closeScene(){
  learnStop();
  currentScene = null; currentExtId = null; currentDialog = [];
  document.getElementById('learnList').style.display = '';
  document.getElementById('learnDetail').classList.remove('on');
  document.getElementById('learnCtrlBar').classList.remove('on');
  renderLearnList(); // 刷新列表状态
}

/* ── 渲染场景详情 ── */
function renderSceneDetail(){
  if(!currentScene) return;

  // 标题
  document.getElementById('learnDetailTitle').textContent =
    currentScene.title || '';

  // 熟悉按钮状态
  const fb = document.getElementById('learnFamiliarBtn');
  const isFam = !!learnFamiliar[currentScene.id];
  fb.classList.toggle('on', isFam);
  fb.textContent = isFam ? '✓ 已熟悉' : '标记已熟悉';

  // 场景说明
  document.getElementById('learnSceneDesc').textContent =
    currentScene.description || '';

  // 扩展会话按钮
  const extBar = document.getElementById('learnExtBar');
  const exts = currentScene.extensions || [];
  if(exts.length){
    extBar.style.display = '';
    extBar.innerHTML =
      `<button class="learn-ext-btn on" onclick="switchDialog(null)">基本会话</button>` +
      exts.map(ex=>`
        <button class="learn-ext-btn" id="extbtn-${ex.id}"
                onclick="switchDialog('${ex.id}')">
          ${esc(ex.title)}
        </button>`).join('');
  } else {
    extBar.style.display = 'none';
  }

  // 渲染对话
  switchDialog(null);
}

function switchDialog(extId){
  currentExtId = extId;
  learnStop();

  // 更新按钮状态
  document.querySelectorAll('.learn-ext-btn').forEach(el=>el.classList.remove('on'));
  const activeBtn = extId
    ? document.getElementById('extbtn-'+extId)
    : document.querySelector('.learn-ext-btn');
  if(activeBtn) activeBtn.classList.add('on');

  // 获取对话数据
  if(extId){
    const ext = (currentScene.extensions||[]).find(e=>e.id===extId);
    currentDialog = ext ? ext.dialog : [];
  } else {
    currentDialog = currentScene.basic?.dialog || [];
  }

  renderDialog();
}

/* ── 渲染对话气泡 ── */
function renderDialog(){
  const wrap = document.getElementById('learnDialogWrap');
  wrap.innerHTML = currentDialog.map((d,i)=>`
    <div class="dialog-bubble ${d.speaker}" id="bubble-${i}">
      <div class="bubble-label">${d.speaker==='you'?'你':'对方'}</div>
      <div class="bubble-body">
        <div class="bubble-jp">${esc(d.jp)}</div>
        <div class="bubble-zh">${esc(d.zh)}</div>
        ${d.note?`<div class="bubble-note">💡 ${esc(d.note)}</div>`:''}
      </div>
    </div>`).join('');

  // 重置播放按钮
  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML = '▶ 开始演练';
}

/* ── 播放控制 ── */
function learnPlay(){
  if(window.speechSynthesis.speaking && !window.speechSynthesis.paused){
    learnPause(); return;
  }
  if(window.speechSynthesis.paused){
    window.speechSynthesis.resume();
    const pb = document.getElementById('learnPlayBtn');
    if(pb) pb.innerHTML = '⏸ 暂停';
    return;
  }
  learnShouldStop = false; learnSession++;
  const session = learnSession;
  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML = '⏸ 暂停';

  // 标记已演练
  if(currentScene){
    learnFamiliar[currentScene.id+'_practiced'] = true;
    saveLearnStorage();
  }

  playDialogSeq(currentDialog, 0, session);
}

function learnPause(){
  window.speechSynthesis.pause();
  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML = '▶ 继续';
}

function learnStop(){
  learnShouldStop = true; learnSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.dialog-bubble.playing')
    .forEach(el=>el.classList.remove('playing'));
  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML = '▶ 开始演练';
}

function learnToggleLoop(){
  learnLoopMode = !learnLoopMode;
  const btn = document.getElementById('learnLoopBtn');
  if(btn) btn.classList.toggle('on', learnLoopMode);
  showToast(learnLoopMode?'循环播放已开启':'循环播放已关闭', 1500);
}

/* ── 对话播放序列 ── */
function playDialogSeq(dialog, idx, session){
  if(learnShouldStop || learnSession!==session) return;

  // 清除所有高亮
  document.querySelectorAll('.dialog-bubble.playing')
    .forEach(el=>el.classList.remove('playing'));

  if(idx >= dialog.length){
    // 播放完毕
    const pb = document.getElementById('learnPlayBtn');
    if(pb) pb.innerHTML = '▶ 再听一遍';
    if(learnLoopMode){
      showToast('🔁 循环播放中…', 1500);
      setTimeout(()=>{
        if(!learnShouldStop && learnSession===session)
          playDialogSeq(dialog, 0, session);
      }, 800);
    } else {
      showDoneBanner();
    }
    return;
  }

  const d = dialog[idx];
  const bubble = document.getElementById('bubble-'+idx);
  if(bubble){
    bubble.classList.add('playing');
    bubble.scrollIntoView({behavior:'smooth', block:'center'});
  }

  // 朗读
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    if(learnShouldStop || learnSession!==session) return;
    const u = new SpeechSynthesisUtterance(d.jp);
    u.lang = 'ja-JP';
    u.rate = 0.75;
    u.pitch = 1;
    if(jaVoice) u.voice = jaVoice;
    const pause = d.pause || (d.speaker==='you' ? 2500 : 1500);
    u.onend = ()=>setTimeout(()=>playDialogSeq(dialog, idx+1, session), pause);
    u.onerror = ()=>setTimeout(()=>playDialogSeq(dialog, idx+1, session), 500);
    window.speechSynthesis.speak(u);
  }, 80);
}

/* ── 演练完成 banner ── */
function showDoneBanner(){
  const wrap = document.getElementById('learnDialogWrap');
  const existing = document.getElementById('learnDoneBanner');
  if(existing) existing.remove();

  const isFam = currentScene && !!learnFamiliar[currentScene.id];
  const banner = document.createElement('div');
  banner.className = 'learn-done-banner';
  banner.id = 'learnDoneBanner';
  banner.innerHTML = `
    <div class="learn-done-emoji">🎉</div>
    <div class="learn-done-title">演练完成！</div>
    <div class="learn-done-desc">
      你现在可以独立应对「${esc(currentScene?.title||'')}」了。
    </div>
    <div class="learn-done-btns">
      <button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>
      ${!isFam?`<button class="btn sm gn" onclick="markFamiliar()">✓ 已熟悉</button>`:''}
    </div>`;
  wrap.appendChild(banner);
  banner.scrollIntoView({behavior:'smooth', block:'center'});
}

function learnReplay(){
  const existing = document.getElementById('learnDoneBanner');
  if(existing) existing.remove();
  learnShouldStop = false; learnSession++;
  const session = learnSession;
  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML = '⏸ 暂停';
  playDialogSeq(currentDialog, 0, session);
}

/* ── 标记已熟悉 ── */
function markFamiliar(){
  if(!currentScene) return;
  learnFamiliar[currentScene.id] = true;
  saveLearnStorage();
  // 更新按钮
  const fb = document.getElementById('learnFamiliarBtn');
  if(fb){ fb.classList.add('on'); fb.textContent='✓ 已熟悉'; }
  // 更新done banner
  const banner = document.getElementById('learnDoneBanner');
  if(banner){
    const btns = banner.querySelector('.learn-done-btns');
    if(btns) btns.innerHTML =
      `<button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>`;
  }
  showToast('✓ 已标记为熟悉', 1800);
}

function toggleFamiliarBtn(){
  if(!currentScene) return;
  if(learnFamiliar[currentScene.id]){
    delete learnFamiliar[currentScene.id];
    const fb = document.getElementById('learnFamiliarBtn');
    if(fb){ fb.classList.remove('on'); fb.textContent='标记已熟悉'; }
    saveLearnStorage();
  } else {
    markFamiliar();
  }
}

/* ── 模块注册 ── */
window.LJ_MODULES = window.LJ_MODULES || {};
window.LJ_MODULES['learn'] = {
  init: async function(cfg, icons){
    // 渲染学习版块的HTML结构
    document.getElementById('panel-learn').innerHTML = `
      <div class="learn-wrap" id="learnList"></div>
      <div id="learnDetail">
        <div class="learn-detail-header">
          <button class="learn-back-btn" onclick="closeScene()">←</button>
          <div class="learn-detail-title" id="learnDetailTitle"></div>
          <button class="learn-familiar-btn" id="learnFamiliarBtn"
                  onclick="toggleFamiliarBtn()">标记已熟悉</button>
        </div>
        <div class="learn-scene-desc" id="learnSceneDesc"></div>
        <div class="learn-ext-bar" id="learnExtBar"></div>
        <div class="learn-dialog-wrap" id="learnDialogWrap"></div>
      </div>`;
    await learnBoot();
  }
};
