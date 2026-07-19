/* ══════════════════════════════
   learn.js — 学习版块逻辑 v4
   Living Japanese v3.0
══════════════════════════════ */

/* ── State ── */
let LEARN_INDEX = null;
let LEARN_CACHE = {};
let learnFamiliar = {};
let currentScene = null;
let currentDialog = [];
let currentExtId = null;
let learnShouldStop = false;
let learnSession = 0;
let learnLoopMode = false;
let currentAudio = null;

const DEFAULT_STAFF_AVATAR = '👨‍💼';
const DEFAULT_USER_AVATAR  = '🧑';

/* ── Web Audio fallback ── */
function playBeep(type){
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const seqs = {
      conbini:     [{f:880,d:.08,t:0},{f:1100,d:.12,t:.1}],
      supermarket: [{f:1200,d:.06,t:0}],
      train:       [{f:440,d:.08,t:0},{f:550,d:.08,t:.12},
                   {f:440,d:.08,t:.24},{f:550,d:.08,t:.36}],
      default:     [{f:660,d:.1,t:0}]
    };
    const seq = seqs[type]||seqs.default;
    seq.forEach(s=>{
      const osc=ctx.createOscillator(), g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value=s.f; osc.type='sine';
      g.gain.setValueAtTime(0,ctx.currentTime+s.t);
      g.gain.linearRampToValueAtTime(.3,ctx.currentTime+s.t+.01);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+s.t+s.d);
      osc.start(ctx.currentTime+s.t);
      osc.stop(ctx.currentTime+s.t+s.d+.05);
    });
  } catch(e){}
}

/* ── 音效播放 ── */
function playSceneSound(scene){
  if(currentAudio){ currentAudio.pause(); currentAudio=null; }
  if(scene.sound_file){
    const audio = new Audio(scene.sound_file);
    audio.volume = 0.6;
    audio.play().catch(()=>playBeep(scene.sound||'default'));
    currentAudio = audio;
  } else {
    playBeep(scene.sound||'default');
  }
}

/* ── 头像渲染 ── */
function renderAvatar(src, fallback, id){
  if(src){
    return `<div class="bubble-avatar" id="${id}">
      <img src="${src}" alt="avatar"
           onerror="this.parentElement.innerHTML='${fallback}'">
    </div>`;
  }
  return `<div class="bubble-avatar" id="${id}">${fallback}</div>`;
}

/* ── Storage ── */
function loadLearnStorage(){
  try{ learnFamiliar=JSON.parse(localStorage.getItem('lj_familiar')||'{}'); }
  catch(e){ learnFamiliar={}; }
}
function saveLearnStorage(){
  try{ localStorage.setItem('lj_familiar',JSON.stringify(learnFamiliar)); }
  catch(e){}
}

/* ── Boot ── */
async function learnBoot(){
  loadLearnStorage();
  try {
    LEARN_INDEX = await fetch('data/lessons/index.json').then(r=>r.json());
    // 并行预加载所有场景元数据
    await Promise.all((LEARN_INDEX.scenes||[]).map(async s=>{
      try {
        const data = await fetch(s.file).then(r=>{
          if(!r.ok) throw new Error('not found');
          return r.json();
        });
        // 把index.json里的元数据合并进场景数据
        LEARN_CACHE[s.id] = Object.assign({}, s, data);
      } catch(e){
        LEARN_CACHE[s.id] = Object.assign({}, s, {_comingSoon: true});
      }
    }));
    renderLearnList();
  } catch(e){
    console.error('学习版块加载失败', e);
  }
}

/* ── 场景列表 ── */
function renderLearnList(){
  const wrap = document.getElementById('learnList');
  if(!wrap||!LEARN_INDEX) return;
  const levels = LEARN_INDEX.levels||[];
  const scenes = LEARN_INDEX.scenes||[];

  wrap.innerHTML = levels.map(lv=>{
    const lvScenes = scenes.filter(s=>s.level===lv.id);
    if(!lvScenes.length) return '';
    const stars = '★'.repeat(lv.star)+'☆'.repeat(5-lv.star);
    return `
      <div class="learn-level-group">
        <div class="learn-level-title">
          <span class="learn-level-stars">${stars}</span>
          ${esc(lv.label)} — ${esc(lv.desc)}
        </div>
        <div class="learn-scene-grid">
          ${lvScenes.map(s=>renderSceneCard(s.id)).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderSceneCard(id){
  const sc = LEARN_CACHE[id]||{};
  const isComingSoon = !!sc._comingSoon;
  const isFamiliar   = !!learnFamiliar[id];
  const isPracticed  = !!learnFamiliar[id+'_practiced'];

  let statusClass='', statusIcon='';
  if(isFamiliar)       { statusClass='familiar';  statusIcon='✓'; }
  else if(isPracticed) { statusClass='practiced'; statusIcon='●'; }

  const hasBg   = !!sc.image;
  const bgStyle = hasBg ? `background-image:url('${sc.image}')` : '';
  const emoji   = sc.emoji||'📖';
  const title   = sc.title||id;

  if(isComingSoon){
    return `
      <div class="learn-scene-card no-image" style="opacity:.5;cursor:default">
        <div class="learn-scene-overlay"></div>
        <div class="learn-scene-content">
          <div class="learn-scene-emoji">${emoji}</div>
          <div class="learn-scene-title">${esc(title)}</div>
          <div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:2px">即将上线</div>
        </div>
      </div>`;
  }

  return `
    <div class="learn-scene-card ${statusClass}${!hasBg?' no-image':''}"
         onclick="openScene('${id}')">
      ${statusIcon?`<div class="learn-scene-status">${statusIcon}</div>`:''}
      <div class="learn-scene-bg" style="${bgStyle}"></div>
      <div class="learn-scene-overlay"></div>
      <div class="learn-scene-content">
        <div class="learn-scene-emoji">${emoji}</div>
        <div class="learn-scene-title">${esc(title)}</div>
      </div>
    </div>`;
}

/* ── 打开场景 ── */
async function openScene(id){
  const sc = LEARN_CACHE[id];
  if(!sc||sc._comingSoon) return;
  currentScene = sc;
  currentExtId = null;

  document.getElementById('learnList').style.display='none';
  document.getElementById('learnDetail').classList.add('on');
  document.getElementById('learnCtrlBar').classList.add('on');

  renderSceneDetail();
  playSceneSound(currentScene);
}

function closeScene(){
  learnStop();
  if(currentAudio){ currentAudio.pause(); currentAudio=null; }
  currentScene=null; currentExtId=null; currentDialog=[];
  document.getElementById('learnList').style.display='';
  document.getElementById('learnDetail').classList.remove('on');
  document.getElementById('learnCtrlBar').classList.remove('on');
  renderLearnList();
}

/* ── 渲染场景详情 ── */
function renderSceneDetail(){
  if(!currentScene) return;

  // Hero背景
  const heroBg = document.getElementById('learnHeroBg');
  if(heroBg){
    heroBg.style.backgroundImage = currentScene.image
      ? `url('${currentScene.image}')` : '';
    heroBg.style.opacity = currentScene.image ? '1' : '0';
  }

  // 场景名称和说明
  const nameEl = document.getElementById('learnDetailSceneName');
  if(nameEl) nameEl.textContent = currentScene.title||'';
  const descEl = document.getElementById('learnDetailSceneDesc');
  if(descEl) descEl.textContent = currentScene.description||'';

  // 熟悉按钮
  const fb = document.getElementById('learnFamiliarBtn');
  const isFam = !!learnFamiliar[currentScene.id];
  if(fb){ fb.classList.toggle('on',isFam); fb.textContent=isFam?'✓ 已熟悉':'标记已熟悉'; }

  // 扩展会话
  const extBar = document.getElementById('learnExtBar');
  const extSec = document.getElementById('learnExtSection');
  const exts   = currentScene.extensions||[];
  if(exts.length){
    extSec.style.display='';
    extBar.innerHTML = exts.map(ex=>`
      <button class="learn-ext-btn" id="extbtn-${ex.id}"
              onclick="switchDialog('${ex.id}')">${esc(ex.title)}</button>`).join('');
  } else {
    extSec.style.display='none';
  }

  switchDialog(null);
}

function switchDialog(extId){
  currentExtId = extId; learnStop();
  document.querySelectorAll('.learn-ext-btn').forEach(el=>el.classList.remove('on'));
  const basicBtn = document.getElementById('learnBasicBtn');
  if(extId){
    const btn = document.getElementById('extbtn-'+extId);
    if(btn) btn.classList.add('on');
    if(basicBtn) basicBtn.classList.remove('on');
    const ext = (currentScene.extensions||[]).find(e=>e.id===extId);
    currentDialog = ext ? ext.dialog : [];
  } else {
    if(basicBtn) basicBtn.classList.add('on');
    currentDialog = currentScene.basic?.dialog||[];
  }
  renderDialog();
}

/* ── 渲染对话气泡 ── */
function renderDialog(){
  const wrap = document.getElementById('learnDialogWrap');
  const staffAvatar = currentScene.staff_avatar||'';
  const userAvatar  = 'assets/avatars/user.png';

  // 展开对话：把店员的note自动拆成你的动作气泡
  const expanded = [];
  currentDialog.forEach((d,i)=>{
    expanded.push({...d, _idx: expanded.length});
    // 如果是对方说的且有note，自动在后面加一个你的动作气泡
    if(d.speaker==='them' && d.note){
      expanded.push({
        speaker: 'you',
        jp: '',
        zh: '',
        note: d.note,
        pause: 1500,
        _isActionOnly: true,
        _idx: expanded.length
      });
    }
  });

  wrap.innerHTML = expanded.map((d,i)=>{
    const isAction = d._isActionOnly ||
                     d.speaker==='action' ||
                     (!d.jp && d.note);

    const parts = d.jp ? d.jp.split('／') : [];
    const hasOptions = parts.length > 1;

    const avatarHtml = d.speaker==='them'
      ? renderAvatar(staffAvatar, DEFAULT_STAFF_AVATAR, `av-${i}`)
      : renderAvatar(userAvatar, DEFAULT_USER_AVATAR, `av-${i}`);

    const bubbleContent = isAction
      ? `<div class="bubble-jp">（${esc(d.note||'')}）</div>`
      : `<div class="bubble-jp">${hasOptions?esc(parts[0]):esc(d.jp||'')}</div>
         ${d.zh?`<div class="bubble-zh">${esc(d.zh.split('／')[0])}</div>`:''}
         ${hasOptions?`<div class="bubble-options">
           ${parts.map(p=>`<span class="bubble-option">${esc(p)}</span>`).join('')}
         </div>`:''}
         ${d.note&&!isAction&&d.speaker!=='them'
           ?`<div class="bubble-note">💡 ${esc(d.note)}</div>`:''}`;

    return `
      <div class="dialog-bubble ${d.speaker}${isAction?' action':''}" id="bubble-${i}">
        ${avatarHtml}
        <div class="bubble-inner">
          <div class="bubble-label">${d.speaker==='you'?'你':'对方'}</div>
          <div class="bubble-body">${bubbleContent}</div>
        </div>
      </div>`;
  }).join('');

  // 保存展开后的对话供播放使用
  currentDialog._expanded = expanded;

  const pb = document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 开始演练';
}

/* ── 播放控制 ── */
function learnPlay(){
  const synth = window.speechSynthesis;
  if(synth.speaking&&!synth.paused){ learnPause(); return; }
  if(synth.paused){
    synth.resume();
    const pb=document.getElementById('learnPlayBtn');
    if(pb) pb.innerHTML='⏸ 暂停';
    return;
  }
  learnShouldStop=false; learnSession++;
  const session=learnSession;
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='⏸ 暂停';
  if(currentScene){
    learnFamiliar[currentScene.id+'_practiced']=true;
    saveLearnStorage();
  }
  document.querySelectorAll('.dialog-bubble').forEach(el=>
    el.classList.remove('playing','muted'));
  const dialog = currentDialog._expanded || currentDialog;
  playDialogSeq(dialog,0,session);
}

function learnPause(){
  window.speechSynthesis.pause();
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 继续';
}

function learnStop(){
  learnShouldStop=true; learnSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.dialog-bubble').forEach(el=>
    el.classList.remove('playing','muted'));
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 开始演练';
}

function learnToggleLoop(){
  learnLoopMode=!learnLoopMode;
  const btn=document.getElementById('learnLoopBtn');
  if(btn) btn.classList.toggle('on',learnLoopMode);
  showToast(learnLoopMode?'循环播放已开启':'循环播放已关闭',1500);
}

/* ── 对话播放序列 ── */
function playDialogSeq(dialog,idx,session){
  if(learnShouldStop||learnSession!==session) return;

  document.querySelectorAll('.dialog-bubble').forEach((el,i)=>{
    el.classList.remove('playing');
    el.classList.toggle('muted', i!==idx && idx<dialog.length);
  });

  if(idx>=dialog.length){
    document.querySelectorAll('.dialog-bubble').forEach(el=>
      el.classList.remove('playing','muted'));
    const pb=document.getElementById('learnPlayBtn');
    if(pb) pb.innerHTML='▶ 再听一遍';
    if(learnLoopMode){
      showToast('🔁 循环播放中…',1500);
      setTimeout(()=>{
        if(!learnShouldStop&&learnSession===session)
          playDialogSeq(dialog,0,session);
      },800);
    } else { showDoneBanner(); }
    return;
  }

  const d = dialog[idx];
  const bubble = document.getElementById('bubble-'+idx);
  if(bubble){
    bubble.classList.add('playing'); bubble.classList.remove('muted');
    bubble.scrollIntoView({behavior:'smooth',block:'center'});
  }

  // 动作气泡不朗读，等待后继续
  if(d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note)){
    setTimeout(()=>playDialogSeq(dialog,idx+1,session), d.pause||1500);
    return;
  }

  window.speechSynthesis.cancel();
  setTimeout(()=>{
    if(learnShouldStop||learnSession!==session) return;
    const text = d.jp ? d.jp.split('／')[0] : '';
    const u=new SpeechSynthesisUtterance(text);
    u.lang='ja-JP'; u.rate=0.75; u.pitch=1;
    if(jaVoice) u.voice=jaVoice;
    const pause=d.pause||(d.speaker==='you'?2500:1500);
    u.onend=()=>setTimeout(()=>playDialogSeq(dialog,idx+1,session),pause);
    u.onerror=()=>setTimeout(()=>playDialogSeq(dialog,idx+1,session),500);
    window.speechSynthesis.speak(u);
  },80);
}

/* ── 演练完成 banner ── */
function showDoneBanner(){
  const wrap=document.getElementById('learnDialogWrap');
  const existing=document.getElementById('learnDoneBanner');
  if(existing) existing.remove();
  const isFam=currentScene&&!!learnFamiliar[currentScene.id];
  const banner=document.createElement('div');
  banner.className='learn-done-banner'; banner.id='learnDoneBanner';
  banner.innerHTML=`
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
  banner.scrollIntoView({behavior:'smooth',block:'center'});
}

function learnReplay(){
  const existing=document.getElementById('learnDoneBanner');
  if(existing) existing.remove();
  learnShouldStop=false; learnSession++;
  const session=learnSession;
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='⏸ 暂停';
  const dialog = currentDialog._expanded || currentDialog;
  playDialogSeq(dialog,0,session);
}

/* ── 标记已熟悉 ── */
function markFamiliar(){
  if(!currentScene) return;
  learnFamiliar[currentScene.id]=true; saveLearnStorage();
  const fb=document.getElementById('learnFamiliarBtn');
  if(fb){ fb.classList.add('on'); fb.textContent='✓ 已熟悉'; }
  const banner=document.getElementById('learnDoneBanner');
  if(banner){
    const btns=banner.querySelector('.learn-done-btns');
    if(btns) btns.innerHTML=
      `<button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>`;
  }
  showToast('✓ 已标记为熟悉',1800);
}

function toggleFamiliarBtn(){
  if(!currentScene) return;
  if(learnFamiliar[currentScene.id]){
    delete learnFamiliar[currentScene.id];
    const fb=document.getElementById('learnFamiliarBtn');
    if(fb){ fb.classList.remove('on'); fb.textContent='标记已熟悉'; }
    saveLearnStorage();
  } else { markFamiliar(); }
}

/* ── 模块注册 ── */
window.LJ_MODULES = window.LJ_MODULES||{};
window.LJ_MODULES['learn'] = {
  init: async function(cfg, icons){
    document.getElementById('panel-learn').innerHTML = `
      <div class="learn-wrap" id="learnList"></div>
      <div id="learnDetail">
        <div class="learn-detail-hero">
          <div class="learn-detail-hero-bg" id="learnHeroBg"></div>
          <div class="learn-detail-hero-overlay"></div>
          <div class="learn-detail-hero-content">
            <div class="learn-detail-hero-top">
              <button class="learn-back-btn" onclick="closeScene()">← 返回</button>
              <button class="learn-familiar-btn" id="learnFamiliarBtn"
                      onclick="toggleFamiliarBtn()">标记已熟悉</button>
            </div>
            <div class="learn-detail-hero-bottom">
              <div class="learn-detail-scene-name" id="learnDetailSceneName"></div>
              <div class="learn-detail-scene-desc" id="learnDetailSceneDesc"></div>
            </div>
          </div>
        </div>
        <div class="learn-ext-section" id="learnExtSection">
          <div class="learn-basic-row">
            <button class="learn-basic-btn on" id="learnBasicBtn"
                    onclick="switchDialog(null)">基本会话</button>
          </div>
          <div class="learn-ext-divider">＋ 场景扩展</div>
          <div id="learnExtBar" class="learn-ext-bar"></div>
        </div>
        <div class="learn-dialog-wrap" id="learnDialogWrap"></div>
      </div>`;
    await learnBoot();
  }
};
