/* ══════════════════════════════
   learn.js — 学习版块逻辑 v5
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
let learnRubyOn = true;
let learnMode = 'jp';
let learnRate = '0.75';

const DEFAULT_STAFF_AVATAR = '👨‍💼';
const DEFAULT_USER_AVATAR  = '🧑';

/* ── 〇〇替换词库 ── */
const REPLACEMENTS = {
  station: ['大阪','梅田','難波','天王寺','心斎橋','京橋','鶴橋','新大阪'],
  bus:     ['難波バス停','梅田バス停','天王寺バス停','心斎橋バス停'],
  place:   ['道頓堀','心斎橋','天満','北浜','本町'],
  price:   ['980','1,200','350','2,500','680','1,050'],
  name:    ['田中','山田','佐藤','鈴木','中村'],
  time:    ['10時','14時30分','18時','9時半'],
  date:    ['7月20日','8月1日','来週の月曜日'],
  num:     ['1','2','3'],
  line:    ['1番線','2番線','3番線','4番線']
};

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function replaceMarkers(text){
  if(!text) return text;
  // 根据上下文替换○○
  return text
    .replace(/○○駅/g, ()=>pick(REPLACEMENTS.station)+'駅')
    .replace(/○○バス停/g, ()=>pick(REPLACEMENTS.bus))
    .replace(/○○円/g, ()=>pick(REPLACEMENTS.price)+'円')
    .replace(/○○時/g, ()=>pick(REPLACEMENTS.time))
    .replace(/○月○日/g, ()=>pick(REPLACEMENTS.date))
    .replace(/○番線/g, ()=>pick(REPLACEMENTS.line))
    .replace(/○名/g, ()=>pick(REPLACEMENTS.num)+'名')
    .replace(/○○と申します/g, ()=>pick(REPLACEMENTS.name)+'と申します')
    .replace(/○○まで/g, ()=>pick(REPLACEMENTS.station)+'まで')
    .replace(/○○行き/g, ()=>pick(REPLACEMENTS.station)+'行き')
    .replace(/○○に行きますか/g, ()=>pick(REPLACEMENTS.station)+'に行きますか')
    .replace(/○○で降ります/g, ()=>pick(REPLACEMENTS.station)+'で降ります')
    .replace(/○○はまだですか/g, ()=>pick(REPLACEMENTS.station)+'はまだですか')
    .replace(/○○/g, ()=>pick(REPLACEMENTS.place));
}

/* ── 振假名（复用sos.js的逻辑）── */
function isKJ2(ch){
  const c=ch.codePointAt(0);
  return(c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||
        (c>=0xF900&&c<=0xFAFF)||c===0x3005;
}
function rubyHtml2(jp, fg){
  if(!fg||fg===jp) return esc(jp);
  const segs=[]; let i=0;
  while(i<jp.length){
    if(isKJ2(jp[i])){
      let k=i; while(k<jp.length&&isKJ2(jp[k]))k++;
      segs.push({t:jp.slice(i,k),k:true}); i=k;
    } else {
      let k=i; while(k<jp.length&&!isKJ2(jp[k]))k++;
      segs.push({t:jp.slice(i,k),k:false}); i=k;
    }
  }
  let fp=0,h='';
  for(let s=0;s<segs.length;s++){
    const sg=segs[s];
    if(!sg.k){const idx=fg.indexOf(sg.t,fp);if(idx!==-1)fp=idx+sg.t.length;h+=esc(sg.t);}
    else{
      let fe=fg.length;
      if(s+1<segs.length){const idx=fg.indexOf(segs[s+1].t,fp);if(idx!==-1)fe=idx;}
      const rd=fg.slice(fp,fe);fp=fe;
      h+=rd?`<ruby>${esc(sg.t)}<rt>${esc(rd)}</rt></ruby>`:esc(sg.t);
    }
  }
  return h;
}

/* ── Web Audio fallback ── */
function playBeep(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const seqs={
      conbini:[{f:880,d:.08,t:0},{f:1100,d:.12,t:.1}],
      supermarket:[{f:1200,d:.06,t:0}],
      train:[{f:440,d:.08,t:0},{f:550,d:.08,t:.12},{f:440,d:.08,t:.24},{f:550,d:.08,t:.36}],
      default:[{f:660,d:.1,t:0}]
    };
    const seq=seqs[type]||seqs.default;
    seq.forEach(s=>{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);
      osc.frequency.value=s.f;osc.type='sine';
      g.gain.setValueAtTime(0,ctx.currentTime+s.t);
      g.gain.linearRampToValueAtTime(.3,ctx.currentTime+s.t+.01);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+s.t+s.d);
      osc.start(ctx.currentTime+s.t);osc.stop(ctx.currentTime+s.t+s.d+.05);
    });
  }catch(e){}
}

/* ── 音效 ── */
function playSceneSound(scene){
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  if(scene.sound_file){
    const audio=new Audio(scene.sound_file);audio.volume=0.6;
    audio.play().catch(()=>playBeep(scene.sound||'default'));
    currentAudio=audio;
  } else {playBeep(scene.sound||'default');}
}

/* ── 头像 ── */
function renderAvatar(src,fallback,id){
  if(src) return `<div class="bubble-avatar" id="${id}"><img src="${src}" alt="avatar" onerror="this.parentElement.innerHTML='${fallback}'"></div>`;
  return `<div class="bubble-avatar" id="${id}">${fallback}</div>`;
}

/* ── Storage ── */
function loadLearnStorage(){
  try{learnFamiliar=JSON.parse(localStorage.getItem('lj_familiar')||'{}');}catch(e){learnFamiliar={};}
}
function saveLearnStorage(){
  try{localStorage.setItem('lj_familiar',JSON.stringify(learnFamiliar));}catch(e){}
}

/* ── Boot ── */
async function learnBoot(){
  loadLearnStorage();
  try{
    LEARN_INDEX=await fetch('data/lessons/index.json').then(r=>r.json());
    await Promise.all((LEARN_INDEX.scenes||[]).map(async s=>{
      try{
        const data=await fetch(s.file).then(r=>{if(!r.ok)throw new Error('404');return r.json();});
        LEARN_CACHE[s.id]=Object.assign({},s,data);
      }catch(e){LEARN_CACHE[s.id]=Object.assign({},s,{_comingSoon:true});}
    }));
    renderLearnList();
  }catch(e){console.error('学习版块加载失败',e);}
}

/* ── 场景列表 ── */
function renderLearnList(){
  const wrap=document.getElementById('learnList');
  if(!wrap||!LEARN_INDEX)return;
  const levels=LEARN_INDEX.levels||[],scenes=LEARN_INDEX.scenes||[];
  wrap.innerHTML=levels.map(lv=>{
    const lvScenes=scenes.filter(s=>s.level===lv.id);
    if(!lvScenes.length)return'';
    const stars='★'.repeat(lv.star)+'☆'.repeat(5-lv.star);
    return`<div class="learn-level-group">
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
  const sc=LEARN_CACHE[id]||{};
  const isCS=!!sc._comingSoon;
  const isFam=!!learnFamiliar[id];
  const isPrac=!!learnFamiliar[id+'_practiced'];
  let sc2='',si='';
  if(isFam){sc2='familiar';si='✓';}else if(isPrac){sc2='practiced';si='●';}
  const hasBg=!!sc.image;
  const bgStyle=hasBg?`background-image:url('${sc.image}')`:'';
  if(isCS) return`<div class="learn-scene-card no-image" style="opacity:.5;cursor:default">
    <div class="learn-scene-overlay"></div>
    <div class="learn-scene-content">
      <div class="learn-scene-emoji">${sc.emoji||'📖'}</div>
      <div class="learn-scene-title">${esc(sc.title||id)}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:2px">即将上线</div>
    </div></div>`;
  return`<div class="learn-scene-card ${sc2}${!hasBg?' no-image':''}" onclick="openScene('${id}')">
    ${si?`<div class="learn-scene-status">${si}</div>`:''}
    <div class="learn-scene-bg" style="${bgStyle}"></div>
    <div class="learn-scene-overlay"></div>
    <div class="learn-scene-content">
      <div class="learn-scene-emoji">${sc.emoji||'📖'}</div>
      <div class="learn-scene-title">${esc(sc.title||id)}</div>
    </div></div>`;
}

/* ── 打开场景 ── */
async function openScene(id){
  const sc=LEARN_CACHE[id];
  if(!sc||sc._comingSoon)return;
  currentScene=sc; currentExtId=null;
  document.getElementById('learnList').style.display='none';
  document.getElementById('learnDetail').classList.add('on');
  document.getElementById('learnCtrlBar').classList.add('on');
  renderSceneDetail();
  playSceneSound(currentScene);
  // 滚动时隐藏/显示Hero
  const dialogWrap = document.getElementById('learnDialogWrap');
  if(dialogWrap){
  dialogWrap.addEventListener('scroll', function(){
    const hero = document.querySelector('.learn-detail-hero');
    if(!hero) return;
    if(this.scrollTop > 40){
      hero.classList.add('collapsed');
    } else {
      hero.classList.remove('collapsed');
    }
  });
}
}

function closeScene(){
  learnStop();
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  // 重置Hero展开状态
  const hero=document.querySelector('.learn-detail-hero');
  if(hero)hero.classList.remove('collapsed');
  currentScene=null;currentExtId=null;currentDialog=[];
  document.getElementById('learnList').style.display='';
  document.getElementById('learnDetail').classList.remove('on');
  document.getElementById('learnCtrlBar').classList.remove('on');
  renderLearnList();
}

/* ── 渲染场景详情 ── */
function renderSceneDetail(){
  if(!currentScene)return;
  const heroBg=document.getElementById('learnHeroBg');
  if(heroBg){
    heroBg.style.backgroundImage=currentScene.image?`url('${currentScene.image}')`:'';
    heroBg.style.opacity=currentScene.image?'1':'0';
  }
  const nameEl=document.getElementById('learnDetailSceneName');
  if(nameEl)nameEl.textContent=currentScene.title||'';
  const descEl=document.getElementById('learnDetailSceneDesc');
  if(descEl)descEl.textContent=currentScene.description||'';
  const fb=document.getElementById('learnFamiliarBtn');
  const isFam=!!learnFamiliar[currentScene.id];
  if(fb){fb.classList.toggle('on',isFam);fb.textContent=isFam?'✓ 已熟悉':'标记已熟悉';}
  const extBar=document.getElementById('learnExtBar');
  const extSec=document.getElementById('learnExtSection');
  const exts=currentScene.extensions||[];
  if(exts.length){
    extSec.style.display='';
    extBar.innerHTML=exts.map(ex=>`<button class="learn-ext-btn" id="extbtn-${ex.id}" onclick="switchDialog('${ex.id}')">${esc(ex.title)}</button>`).join('');
  } else {extSec.style.display='none';}
  switchDialog(null);
}

function switchDialog(extId){
  currentExtId=extId;learnStop();
  document.querySelectorAll('.learn-ext-btn').forEach(el=>el.classList.remove('on'));
  const basicBtn=document.getElementById('learnBasicBtn');
  if(extId){
    const btn=document.getElementById('extbtn-'+extId);
    if(btn)btn.classList.add('on');
    if(basicBtn)basicBtn.classList.remove('on');
    const ext=(currentScene.extensions||[]).find(e=>e.id===extId);
    currentDialog=ext?ext.dialog:[];
  } else {
    if(basicBtn)basicBtn.classList.add('on');
    currentDialog=currentScene.basic?.dialog||[];
  }
  renderDialog();
}

/* ── 展开对话（处理备选项和note）── */
function expandDialog(dialog){
  const expanded=[];
  dialog.forEach(d=>{
    // 处理备选项：用／分隔的，拆成多个气泡
    const jpParts=(d.jp||'').split('／').map(s=>s.trim()).filter(Boolean);
    const zhParts=(d.zh||'').split('／').map(s=>s.trim());

    if(jpParts.length>1&&d.speaker==='you'){
      // 第一项作为主气泡
      expanded.push({...d, jp:jpParts[0], zh:zhParts[0]||'', _idx:expanded.length});
      // 后续项作为独立备选气泡
      jpParts.slice(1).forEach((jp,i)=>{
        expanded.push({
          speaker:'you', jp, zh:zhParts[i+1]||'',
          pause:d.pause||2500, _isAlt:true, _idx:expanded.length
        });
      });
    } else if(jpParts.length>1&&d.speaker==='them'){
      // 对方的备选项也拆开
      expanded.push({...d, jp:jpParts[0], zh:zhParts[0]||'', _idx:expanded.length});
      jpParts.slice(1).forEach((jp,i)=>{
        expanded.push({
          speaker:'them', jp, zh:zhParts[i+1]||'',
          pause:d.pause||1500, _isAlt:true, _idx:expanded.length
        });
      });
    } else {
      expanded.push({...d, _idx:expanded.length});
    }

    // 如果对方说的有note（属于你的动作），自动加你的动作气泡
    if(d.speaker==='them'&&d.note){
      expanded.push({
        speaker:'you', jp:'', zh:'', note:d.note,
        pause:1500, _isActionOnly:true, _idx:expanded.length
      });
    }
  });
  return expanded;
}

/* ── 渲染对话气泡 ── */
function renderDialog(){
  const wrap=document.getElementById('learnDialogWrap');
  const staffAvatar=currentScene.staff_avatar||'';
  const userAvatar='assets/avatars/user.png';
  const expanded=expandDialog(currentDialog);
  currentDialog._expanded=expanded;

  wrap.innerHTML=expanded.map((d,i)=>{
    const isAction=d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note);
    const isAlt=!!d._isAlt;
    const avatarHtml=d.speaker==='them'
      ?renderAvatar(staffAvatar,DEFAULT_STAFF_AVATAR,`av-${i}`)
      :renderAvatar(userAvatar,DEFAULT_USER_AVATAR,`av-${i}`);

    // 振假名处理
    const jpDisplay=d.jp
      ?(learnRubyOn?rubyHtml2(d.jp,d.furigana||d.jp):esc(d.jp))
      :'';

    const bubbleContent=isAction
      ?`<div class="bubble-jp bubble-action-text">（${esc(d.note||'')}）</div>`
      :`<div class="bubble-jp${isAlt?' bubble-alt':''}">${jpDisplay}</div>
        ${d.zh?`<div class="bubble-zh">${esc(d.zh)}</div>`:''}
        ${d.note&&!isAction&&d.speaker!=='them'?`<div class="bubble-note">💡 ${esc(d.note)}</div>`:''}`;

    return`<div class="dialog-bubble ${d.speaker}${isAction?' action':''}${isAlt?' alt':''}" id="bubble-${i}">
      ${avatarHtml}
      <div class="bubble-inner">
        <div class="bubble-label">${d.speaker==='you'?'你':'对方'}</div>
        <div class="bubble-body">${bubbleContent}</div>
      </div>
    </div>`;
  }).join('');

  const pb=document.getElementById('learnPlayBtn');
  if(pb)pb.innerHTML='▶ 开始演练';
}

/* ── 注音切换 ── */
function learnToggleRuby(){
  learnRubyOn=!learnRubyOn;
  const btn=document.getElementById('learnRubyBtn');
  if(btn)btn.classList.toggle('on',!learnRubyOn);
  // 重新渲染对话
  if(currentScene)renderDialog();
}

/* ── 模式和速度 ── */
function learnSetMode(m){
  learnMode=m;
  ['jp','jp_zh','repeat'].forEach(k=>{
    const el=document.getElementById('lmode-'+k);
    if(el)el.classList.toggle('on',k===m);
  });
}
function learnSetRate(r){
  learnRate=r;
  ['0.9','0.75','0.6'].forEach(k=>{
    const el=document.getElementById('lrate-'+k);
    if(el)el.classList.toggle('on',k===r);
  });
}

/* ── 播放控制 ── */
function learnPlay(){
  const synth=window.speechSynthesis;
  if(synth.speaking&&!synth.paused){learnPause();return;}
  if(synth.paused){
    synth.resume();
    const pb=document.getElementById('learnPlayBtn');
    if(pb)pb.innerHTML='⏸ 暂停';
    return;
  }
  learnShouldStop=false;learnSession++;
  const session=learnSession;
  const pb=document.getElementById('learnPlayBtn');
  if(pb)pb.innerHTML='⏸ 暂停';
  if(currentScene){learnFamiliar[currentScene.id+'_practiced']=true;saveLearnStorage();}
  document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
  const dialog=currentDialog._expanded||expandDialog(currentDialog);
  playDialogSeq(dialog,0,session);
}

function learnPause(){
  window.speechSynthesis.pause();
  const pb=document.getElementById('learnPlayBtn');
  if(pb)pb.innerHTML='▶ 继续';
}

function learnStop(){
  learnShouldStop=true;learnSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
  const pb=document.getElementById('learnPlayBtn');
  if(pb)pb.innerHTML='▶ 开始演练';
}

function learnToggleLoop(){
  learnLoopMode=!learnLoopMode;
  const btn=document.getElementById('learnLoopBtn');
  if(btn)btn.classList.toggle('on',learnLoopMode);
  showToast(learnLoopMode?'循环播放已开启':'循环播放已关闭',1500);
}

/* ── 获取朗读文本（根据模式）── */
function getLearnTexts(d){
  if(learnMode==='jp') return [{t:d.jp,l:'ja-JP',v:jaVoice}];
  if(learnMode==='jp_zh') return [
    {t:d.jp,l:'ja-JP',v:jaVoice},
    {t:d.zh,l:'zh-CN',v:zhVoice}
  ];
  return [
    {t:d.jp,l:'ja-JP',v:jaVoice},
    {t:d.zh,l:'zh-CN',v:zhVoice},
    {t:d.jp,l:'ja-JP',v:jaVoice}
  ];
}

/* ── 对话播放序列 ── */
function playDialogSeq(dialog,idx,session){
  if(learnShouldStop||learnSession!==session)return;
  document.querySelectorAll('.dialog-bubble').forEach((el,i)=>{
    el.classList.remove('playing');
    el.classList.toggle('muted',i!==idx&&idx<dialog.length);
  });
  if(idx>=dialog.length){
    document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
    const pb=document.getElementById('learnPlayBtn');
    if(pb)pb.innerHTML='▶ 再听一遍';
    if(learnLoopMode){
      showToast('🔁 循环播放中…',1500);
      setTimeout(()=>{if(!learnShouldStop&&learnSession===session)playDialogSeq(dialog,0,session);},800);
    } else {showDoneBanner();}
    return;
  }
  const d=dialog[idx];
  const bubble=document.getElementById('bubble-'+idx);
  if(bubble){bubble.classList.add('playing');bubble.classList.remove('muted');
    bubble.scrollIntoView({behavior:'smooth',block:'center'});}

  // 动作气泡不朗读
  if(d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note)){
    setTimeout(()=>playDialogSeq(dialog,idx+1,session),d.pause||1500);return;
  }

  const segs=getLearnTexts(d).filter(s=>s.t);
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    if(learnShouldStop||learnSession!==session)return;
    let si=0;
    function nextSeg(){
      if(learnShouldStop||learnSession!==session)return;
      if(si>=segs.length){
        const pause=d.pause||(d.speaker==='you'?2500:1500);
        setTimeout(()=>playDialogSeq(dialog,idx+1,session),pause);return;
      }
      const sg=segs[si++];
      const u=new SpeechSynthesisUtterance(sg.t);
      u.lang=sg.l;u.rate=parseFloat(learnRate);u.pitch=1;
      if(sg.v)u.voice=sg.v;
      u.onend=()=>setTimeout(nextSeg,300);
      u.onerror=()=>setTimeout(nextSeg,100);
      window.speechSynthesis.speak(u);
    }
    nextSeg();
  },80);
}

/* ── 演练完成 ── */
function showDoneBanner(){
  const wrap=document.getElementById('learnDialogWrap');
  const existing=document.getElementById('learnDoneBanner');
  if(existing)existing.remove();
  const isFam=currentScene&&!!learnFamiliar[currentScene.id];
  const banner=document.createElement('div');
  banner.className='learn-done-banner';banner.id='learnDoneBanner';
  banner.innerHTML=`
    <div class="learn-done-emoji">🎉</div>
    <div class="learn-done-title">演练完成！</div>
    <div class="learn-done-desc">你现在可以独立应对「${esc(currentScene?.title||'')}」了。</div>
    <div class="learn-done-btns">
      <button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>
      ${!isFam?`<button class="btn sm gn" onclick="markFamiliar()">✓ 已熟悉</button>`:''}
    </div>`;
  wrap.appendChild(banner);
  banner.scrollIntoView({behavior:'smooth',block:'center'});
}

function learnReplay(){
  const existing=document.getElementById('learnDoneBanner');
  if(existing)existing.remove();
  learnShouldStop=false;learnSession++;
  const session=learnSession;
  const pb=document.getElementById('learnPlayBtn');
  if(pb)pb.innerHTML='⏸ 暂停';
  const dialog=currentDialog._expanded||expandDialog(currentDialog);
  playDialogSeq(dialog,0,session);
}

function markFamiliar(){
  if(!currentScene)return;
  learnFamiliar[currentScene.id]=true;saveLearnStorage();
  const fb=document.getElementById('learnFamiliarBtn');
  if(fb){fb.classList.add('on');fb.textContent='✓ 已熟悉';}
  const banner=document.getElementById('learnDoneBanner');
  if(banner){
    const btns=banner.querySelector('.learn-done-btns');
    if(btns)btns.innerHTML=`<button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>`;
  }
  showToast('✓ 已标记为熟悉',1800);
}

function toggleFamiliarBtn(){
  if(!currentScene)return;
  if(learnFamiliar[currentScene.id]){
    delete learnFamiliar[currentScene.id];
    const fb=document.getElementById('learnFamiliarBtn');
    if(fb){fb.classList.remove('on');fb.textContent='标记已熟悉';}
    saveLearnStorage();
  } else {markFamiliar();}
}

/* ── 模块注册 ── */
window.LJ_MODULES=window.LJ_MODULES||{};
window.LJ_MODULES['learn']={
  init:async function(cfg,icons){
    document.getElementById('panel-learn').innerHTML=`
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

    // Controls Bar内容
    document.getElementById('learnCtrlBar').innerHTML=`
      <div class="learn-ctrl-main">
        <button class="learn-play-btn" id="learnPlayBtn" onclick="learnPlay()">▶ 开始演练</button>
        <button class="learn-ctrl-icon" id="learnLoopBtn" onclick="learnToggleLoop()">🔁</button>
        <button class="learn-ctrl-icon rd" onclick="learnStop()">■</button>
        <button class="learn-ctrl-icon sm-text" id="learnRubyBtn" onclick="learnToggleRuby()">注音</button>
      </div>
      <div class="learn-ctrl-settings">
        <div class="lseg">
          <button class="btn on" id="lmode-jp" onclick="learnSetMode('jp')">仅日语</button>
          <button class="btn" id="lmode-jp_zh" onclick="learnSetMode('jp_zh')">日→中</button>
          <button class="btn" id="lmode-repeat" onclick="learnSetMode('repeat')">日→中→日</button>
        </div>
        <div class="lseg">
          <button class="btn" id="lrate-0.9" onclick="learnSetRate('0.9')">普通</button>
          <button class="btn on" id="lrate-0.75" onclick="learnSetRate('0.75')">慢</button>
          <button class="btn" id="lrate-0.6" onclick="learnSetRate('0.6')">更慢</button>
        </div>
      </div>`;

    await learnBoot();
  }
};
