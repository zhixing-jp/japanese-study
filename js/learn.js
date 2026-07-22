/* ══════════════════════════════
   learn.js — 学习版块逻辑 v7
   Living Japanese v3.0
══════════════════════════════ */

/* ── State ── */
let LEARN_INDEX   = null;
let LEARN_CACHE   = {};
let learnFamiliar = {};
let currentScene  = null;
let currentDialog = [];
let currentExtId  = null;
let learnShouldStop  = false;
let learnSession     = 0;
let learnLoopMode    = false;
let currentAudio     = null;
let learnRubyOn      = true;
let learnMode        = 'jp';
let learnRate        = '0.75';
let learnFollowMode  = false; // false=连续 true=跟读

const DEFAULT_STAFF_AVATAR = '👨‍💼';

/* ── 场景色盘（12色循环）── */
const SCENE_COLORS = [
  ['#1a3a5c','#1a6aaa'],
  ['#1a4a2e','#1a8a4e'],
  ['#3a1a1a','#8a2d2d'],
  ['#2a1a3a','#6a2d8a'],
  ['#3a2a1a','#8a6a2d'],
  ['#1a3a3a','#1a8a8a'],
  ['#3a1a3a','#8a2d6a'],
  ['#1a2a3a','#2d5a8a'],
  ['#2a3a1a','#5a8a2d'],
  ['#3a2a2a','#8a5a2d'],
  ['#1a1a3a','#4a2d8a'],
  ['#2a1a1a','#6a3a2d'],
];
function getSceneColor(idx){
  return SCENE_COLORS[idx % SCENE_COLORS.length];
}
const DEFAULT_USER_AVATAR  = '🧑';

/* ── 振假名 ── */
function isKJ(ch){
  const c=ch.codePointAt(0);
  return(c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||
        (c>=0xF900&&c<=0xFAFF)||c===0x3005;
}
function buildRuby(jp,fg){
  if(!fg||fg===jp) return esc(jp);
  const segs=[]; let i=0;
  while(i<jp.length){
    if(isKJ(jp[i])){
      let k=i; while(k<jp.length&&isKJ(jp[k]))k++;
      segs.push({t:jp.slice(i,k),k:true}); i=k;
    } else {
      let k=i; while(k<jp.length&&!isKJ(jp[k]))k++;
      segs.push({t:jp.slice(i,k),k:false}); i=k;
    }
  }
  let fp=0,h='';
  for(let s=0;s<segs.length;s++){
    const sg=segs[s];
    if(!sg.k){
      const idx=fg.indexOf(sg.t,fp); if(idx!==-1) fp=idx+sg.t.length;
      h+=esc(sg.t);
    } else {
      let fe=fg.length;
      if(s+1<segs.length){const idx=fg.indexOf(segs[s+1].t,fp);if(idx!==-1)fe=idx;}
      const rd=fg.slice(fp,fe); fp=fe;
      h+=rd?`<ruby>${esc(sg.t)}<rt>${esc(rd)}</rt></ruby>`:esc(sg.t);
    }
  }
  return h;
}
function jpHtml(jp,fg){
  if(!jp) return '';
  if(!learnRubyOn) return esc(jp);
  return buildRuby(jp,fg||jp);
}

/* ── Web Audio fallback ── */
function playBeep(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const seqs={
      conbini:     [{f:880,d:.08,t:0},{f:1100,d:.12,t:.1}],
      supermarket: [{f:1200,d:.06,t:0}],
      train:       [{f:440,d:.08,t:0},{f:550,d:.08,t:.12},
                   {f:440,d:.08,t:.24},{f:550,d:.08,t:.36}],
      default:     [{f:660,d:.1,t:0}]
    };
    const seq=seqs[type]||seqs.default;
    seq.forEach(s=>{
      const osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value=s.f; osc.type='sine';
      g.gain.setValueAtTime(0,ctx.currentTime+s.t);
      g.gain.linearRampToValueAtTime(.3,ctx.currentTime+s.t+.01);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+s.t+s.d);
      osc.start(ctx.currentTime+s.t);
      osc.stop(ctx.currentTime+s.t+s.d+.05);
    });
  }catch(e){}
}

/* ── 音效 ── */
function playSceneSound(scene){
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  if(scene.sound_file){
    const a=new Audio(scene.sound_file); a.volume=0.6;
    a.play().catch(()=>playBeep(scene.sound||'default'));
    currentAudio=a;
  } else { playBeep(scene.sound||'default'); }
}

/* ── 头像 ── */
function mkAvatar(src,fb,id){
  if(src) return `<div class="bubble-avatar" id="${id}"><img src="${src}" alt="" onerror="this.parentElement.innerHTML='${fb}'"></div>`;
  return `<div class="bubble-avatar" id="${id}">${fb}</div>`;
}

/* ── Storage ── */
function loadLearnStorage(){
  try{learnFamiliar=JSON.parse(localStorage.getItem('lj_familiar')||'{}');}
  catch(e){learnFamiliar={};}
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
        const data=await fetch(s.file).then(r=>{
          if(!r.ok) throw new Error('404'); return r.json();
        });
        LEARN_CACHE[s.id]=Object.assign({},s,data);
      }catch(e){
        LEARN_CACHE[s.id]=Object.assign({},s,{_comingSoon:true});
      }
    }));
    renderLearnList();
  }catch(e){ console.error('学习版块加载失败',e); }
}

/* ── 场景列表 ── */
function renderLearnList(){
  const wrap=document.getElementById('learnList');
  if(!wrap||!LEARN_INDEX) return;
  const levels=LEARN_INDEX.levels||[], scenes=LEARN_INDEX.scenes||[];
  wrap.innerHTML=levels.map(lv=>{
    const lvScenes=scenes.filter(s=>s.level===lv.id);
    if(!lvScenes.length) return '';
    const stars='★'.repeat(lv.star)+'☆'.repeat(5-lv.star);
    return`<div class="learn-level-group">
      <div class="learn-level-title">
        <span class="learn-level-stars">${stars}</span>
        ${esc(lv.label)} — ${esc(lv.desc)}
      </div>
      <div class="learn-scene-grid">
        ${lvScenes.map(s=>mkSceneCard(s.id)).join('')}
      </div>
    </div>`;
  }).join('');
}

function mkSceneCard(id){
  const sc=LEARN_CACHE[id]||{};
  if(sc._comingSoon) return`
    <div class="learn-scene-card no-image" style="opacity:.5;cursor:default">
      <div class="learn-scene-overlay"></div>
      <div class="learn-scene-content">
        <div class="learn-scene-emoji">${sc.emoji||'📖'}</div>
        <div class="learn-scene-title">${esc(sc.title||id)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:2px">即将上线</div>
      </div>
    </div>`;
  const isFam=!!learnFamiliar[id], isPrac=!!learnFamiliar[id+'_practiced'];
  const sc2=isFam?'familiar':isPrac?'practiced':'';
  const si=isFam?'✓':isPrac?'●':'';
  const hasBg=!!sc.image;
  const scIdx=(LEARN_INDEX.scenes||[]).findIndex(s=>s.id===id);
  const [c1,c2]=getSceneColor(scIdx);
  const bgStyle=hasBg
    ?`background-image:url('${sc.image}')`
    :`background:linear-gradient(135deg,${c1} 0%,${c2} 100%)`;
  return`<div class="learn-scene-card ${sc2}" onclick="openScene('${id}')">
    ${si?`<div class="learn-scene-status">${si}</div>`:''}
    <div class="learn-scene-bg" style="${bgStyle}"></div>
    <div class="learn-scene-overlay"${hasBg?'':' style="display:none"'}></div>
    <div class="learn-scene-content">
      <div class="learn-scene-emoji">${sc.emoji||'📖'}</div>
      <div class="learn-scene-title">${esc(sc.title||id)}</div>
    </div>
  </div>`;
}

/* ── 打开/关闭场景 ── */
async function openScene(id){
  const sc=LEARN_CACHE[id];
  if(!sc||sc._comingSoon) return;
  currentScene=sc; currentExtId=null;
  document.getElementById('learnList').style.display='none';
  const detail=document.getElementById('learnDetail');
  detail.classList.add('on');
  detail.style.animation='none';
  requestAnimationFrame(()=>{ detail.style.animation='fadeIn .2s ease-out'; });
  document.getElementById('learnCtrlBar').classList.add('on');
  document.querySelector('main').classList.add('has-ctrl');
  renderSceneDetail();
  playSceneSound(currentScene);
  // 滚动时隐藏/显示Hero
  const dw=document.getElementById('learnDialogWrap');
  if(dw){
    let _ht=null;
    dw.onscroll=function(){
      clearTimeout(_ht);
      _ht=setTimeout(()=>{
        const hero=document.querySelector('.learn-detail-hero');
        if(hero) hero.classList.toggle('collapsed',dw.scrollTop>40);
      },80);
    };
  }
}

function closeScene(){
  learnStop();
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  const hero=document.querySelector('.learn-detail-hero');
  if(hero) hero.classList.remove('collapsed');
  const dw=document.getElementById('learnDialogWrap');
  if(dw) dw.onscroll=null;
  currentScene=null; currentExtId=null; currentDialog=[];
  const list=document.getElementById('learnList');
  list.style.display='';
  list.style.animation='none';
  requestAnimationFrame(()=>{ list.style.animation='fadeIn .2s ease-out'; });
  document.getElementById('learnDetail').classList.remove('on');
  updateCtrlBar(false);
  renderLearnList();
}

/* ── Controls Bar状态 ── */
function updateCtrlBar(inScene){
  const r1=document.getElementById('learnCtrlRow1');
  if(r1) r1.style.display=inScene?'flex':'none';
}

/* ── 渲染场景详情 ── */
function renderSceneDetail(){
  if(!currentScene) return;
  const heroBg=document.getElementById('learnHeroBg');
  if(heroBg){
    heroBg.style.backgroundImage=currentScene.image?`url('${currentScene.image}')`:'';
  }
  const nameEl=document.getElementById('learnDetailSceneName');
  if(nameEl) nameEl.textContent=currentScene.title||'';
  const descEl=document.getElementById('learnDetailSceneDesc');
  if(descEl) descEl.textContent=currentScene.description||'';
  updateCtrlBar(true);
  const fb=document.getElementById('learnFamiliarCtrl');
  const isFam=!!learnFamiliar[currentScene.id];
  if(fb){fb.classList.toggle('on',isFam);fb.textContent=isFam?'✓ 学会了':'学会了';}
  const extBar=document.getElementById('learnExtBar');
  const extSec=document.getElementById('learnExtSection');
  const exts=currentScene.extensions||[];
  if(exts.length){
    extSec.style.display='';
    extBar.innerHTML=exts.map(ex=>
      `<button class="learn-ext-btn" id="extbtn-${ex.id}"
               onclick="switchDialog('${ex.id}')">${esc(ex.title)}</button>`
    ).join('');
  } else { extSec.style.display='none'; }
  switchDialog(null);
}

function switchDialog(extId){
  currentExtId=extId; learnStop();
  document.querySelectorAll('.learn-ext-btn').forEach(el=>el.classList.remove('on'));
  const basicBtn=document.getElementById('learnBasicBtn');
  if(extId){
    const btn=document.getElementById('extbtn-'+extId);
    if(btn) btn.classList.add('on');
    if(basicBtn) basicBtn.classList.remove('on');
    const ext=(currentScene.extensions||[]).find(e=>e.id===extId);
    currentDialog=ext?ext.dialog:[];
  } else {
    if(basicBtn) basicBtn.classList.add('on');
    currentDialog=currentScene.basic?.dialog||[];
  }
  renderDialog();
}

/* ── 展开对话 ── */
function expandDialog(dialog){
  const out=[];
  dialog.forEach(d=>{
    const jpParts=(d.jp||'').split('／').map(s=>s.trim()).filter(Boolean);
    const zhParts=(d.zh||'').split('／').map(s=>s.trim());
    const fgParts=(d.furigana||'').split('／').map(s=>s.trim());
    if(jpParts.length>1){
      out.push({...d,jp:jpParts[0],zh:zhParts[0]||'',furigana:fgParts[0]||''});
      jpParts.slice(1).forEach((jp,i)=>{
        out.push({speaker:d.speaker,jp,zh:zhParts[i+1]||'',
          furigana:fgParts[i+1]||'',_isAlt:true});
      });
    } else { out.push({...d}); }
    if(d.speaker==='them'&&d.note){
      out.push({speaker:'you',jp:'',zh:'',furigana:'',
        note:d.note,_isActionOnly:true});
    }
  });
  return out;
}

/* ── 渲染对话 ── */
function renderDialog(){
  const wrap=document.getElementById('learnDialogWrap');
  if(!wrap) return;
  const staffAvatar=currentScene.staff_avatar||'';
  const userAvatar='assets/avatars/user.png';
  const expanded=expandDialog(currentDialog);
  currentDialog._expanded=expanded;

  wrap.innerHTML=expanded.map((d,i)=>{
    const isAction=d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note);
    const isAlt=!!d._isAlt;
    const avatarHtml=d.speaker==='them'
      ?mkAvatar(staffAvatar,DEFAULT_STAFF_AVATAR,`av-${i}`)
      :mkAvatar(userAvatar,DEFAULT_USER_AVATAR,`av-${i}`);
    const jpRaw=d.jp||'';
    const fgRaw=d.furigana||'';
    const zhRaw=d.zh||'';
    const jpDisplay=isAction?'':jpHtml(jpRaw,fgRaw);
    const bubbleContent=isAction
      ?`<div class="bubble-jp" style="font-style:italic;font-size:13px;color:var(--t3)">（${esc(d.note||'')}）</div>`
      :`<div class="bubble-jp">${jpDisplay}</div>
        ${zhRaw?`<div class="bubble-zh">${esc(zhRaw)}</div>`:''}
        ${d.note&&d.speaker!=='them'?`<div class="bubble-note">💡 ${esc(d.note)}</div>`:''}`;
    return`<div class="dialog-bubble ${d.speaker}${isAction?' action':''}${isAlt?' alt':''}" id="bubble-${i}">
      ${avatarHtml}
      <div class="bubble-inner">
        <div class="bubble-label">${d.speaker==='you'?'你':'对方'}</div>
        <div class="bubble-body">${bubbleContent}</div>
      </div>
    </div>`;
  }).join('');

  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 开始演练';
  wrap.scrollTop=0;
}

/* ── 注音切换 ── */
function learnToggleRuby(){
  learnRubyOn=!learnRubyOn;
  const btn=document.getElementById('learnRubyBtn');
  if(btn) btn.classList.toggle('on',!learnRubyOn);
  if(currentScene) renderDialog();
}

/* ── 跟读/连续切换 ── */
function learnToggleFollow(){
  learnFollowMode=!learnFollowMode;
  const btn=document.getElementById('learnFollowBtn');
  if(btn) btn.classList.toggle('on',learnFollowMode);
  showToast(learnFollowMode?'跟读模式：每句留白':'连续模式：流畅播放',1500);
}

/* ── 模式/速度 ── */
function learnSetMode(m){
  learnMode=m;
  ['jp','jp_zh','repeat'].forEach(k=>{
    const el=document.getElementById('lmode-'+k);
    if(el) el.classList.toggle('on',k===m);
  });
}
function learnSetRate(r){
  learnRate=r;
  ['0.9','0.75','0.6'].forEach(k=>{
    const el=document.getElementById('lrate-'+k);
    if(el) el.classList.toggle('on',k===r);
  });
}

/* ── 已熟悉 ── */
function markFamiliar(){
  if(!currentScene) return;
  learnFamiliar[currentScene.id]=true; saveLearnStorage();
  const fb=document.getElementById('learnFamiliarCtrl');
  if(fb){fb.classList.add('on');fb.textContent='✓ 学会了';}
  const banner=document.getElementById('learnDoneBanner');
  if(banner){
    const btns=banner.querySelector('.learn-done-btns');
    if(btns) btns.innerHTML=`<button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>`;
  }
  showToast('✓ 学会了',1800);
}
function toggleFamiliarCtrl(){
  if(!currentScene) return;
  if(learnFamiliar[currentScene.id]){
    delete learnFamiliar[currentScene.id];
    const fb=document.getElementById('learnFamiliarCtrl');
    if(fb){fb.classList.remove('on');fb.textContent='学会了';}
    saveLearnStorage();
  } else { markFamiliar(); }
}

/* ── 播放 ── */
function learnPlay(){
  const synth=window.speechSynthesis;
  if(synth.speaking&&!synth.paused){learnPause();return;}
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
  if(currentScene){learnFamiliar[currentScene.id+'_practiced']=true;saveLearnStorage();}
  document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
  const dialog=currentDialog._expanded||expandDialog(currentDialog);
  playSeq(dialog,0,session);
}
function learnPause(){
  window.speechSynthesis.pause();
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 继续';
}
function learnStop(){
  learnShouldStop=true; learnSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='▶ 开始演练';
}
function learnToggleLoop(){
  learnLoopMode=!learnLoopMode;
  const btn=document.getElementById('learnLoopBtn');
  if(btn) btn.classList.toggle('on',learnLoopMode);
  showToast(learnLoopMode?'循环播放已开启':'循环播放已关闭',1500);
}

/* ── 获取朗读文本 ── */
function getTexts(d){
  const jp=d.furigana||d.jp||'';
  const zh=d.zh||'';
  if(learnMode==='jp')    return [{t:jp,l:'ja-JP',v:jaVoice}];
  if(learnMode==='jp_zh') return [{t:jp,l:'ja-JP',v:jaVoice},{t:zh,l:'zh-CN',v:zhVoice}];
  return [{t:jp,l:'ja-JP',v:jaVoice},{t:zh,l:'zh-CN',v:zhVoice},{t:jp,l:'ja-JP',v:jaVoice}];
}

/* ── 对话播放序列 ── */
function playSeq(dialog,idx,session){
  if(learnShouldStop||learnSession!==session) return;
  document.querySelectorAll('.dialog-bubble').forEach((el,i)=>{
    el.classList.remove('playing');
    el.classList.toggle('muted',i!==idx&&idx<dialog.length);
  });
  if(idx>=dialog.length){
    document.querySelectorAll('.dialog-bubble').forEach(el=>el.classList.remove('playing','muted'));
    const pb=document.getElementById('learnPlayBtn');
    if(pb) pb.innerHTML='▶ 再听一遍';
    if(learnLoopMode){
      showToast('🔁 循环播放中…',1500);
      setTimeout(()=>{if(!learnShouldStop&&learnSession===session)playSeq(dialog,0,session);},800);
    } else { showDoneBanner(); }
    return;
  }
  const d=dialog[idx];
  const bubble=document.getElementById('bubble-'+idx);
  if(bubble){
    bubble.classList.add('playing'); bubble.classList.remove('muted');
    bubble.scrollIntoView({behavior:'smooth',block:'center'});
  }
  // 动作气泡不朗读，固定600ms后继续
  if(d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note)){
    setTimeout(()=>playSeq(dialog,idx+1,session),600);
    return;
  }
  const segs=getTexts(d).filter(s=>s.t);
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    if(learnShouldStop||learnSession!==session) return;
    let si=0;
    function nextSeg(){
      if(learnShouldStop||learnSession!==session) return;
      if(si>=segs.length){
        // ★ 关键：完全忽略d.pause，只用模式判断
        const pause = learnFollowMode && d.speaker==='you' ? 1500 : 600;
        setTimeout(()=>playSeq(dialog,idx+1,session), pause);
        return;
      }
      const sg=segs[si++];
      const u=new SpeechSynthesisUtterance(sg.t);
      u.lang=sg.l; u.rate=parseFloat(learnRate); u.pitch=1;
      if(sg.v) u.voice=sg.v;
      u.onend=()=>setTimeout(nextSeg,200);
      u.onerror=()=>setTimeout(nextSeg,100);
      window.speechSynthesis.speak(u);
    }
    nextSeg();
  },80);
}

/* ── 演练完成 ── */
function showDoneBanner(){
  const wrap=document.getElementById('learnDialogWrap');
  const ex=document.getElementById('learnDoneBanner');
  if(ex) ex.remove();
  const isFam=currentScene&&!!learnFamiliar[currentScene.id];
  const b=document.createElement('div');
  b.className='learn-done-banner'; b.id='learnDoneBanner';
  b.innerHTML=`
    <div class="learn-done-emoji">🎉</div>
    <div class="learn-done-title">演练完成！</div>
    <div class="learn-done-desc">你现在可以独立应对「${esc(currentScene?.title||'')}」了。</div>
    <div class="learn-done-btns">
      <button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>
      ${!isFam?`<button class="btn sm gn" onclick="markFamiliar()">✓ 已熟悉</button>`:''}
    </div>`;
  wrap.appendChild(b);
  b.scrollIntoView({behavior:'smooth',block:'center'});
}
function learnReplay(){
  const ex=document.getElementById('learnDoneBanner');
  if(ex) ex.remove();
  learnShouldStop=false; learnSession++;
  const session=learnSession;
  const pb=document.getElementById('learnPlayBtn');
  if(pb) pb.innerHTML='⏸ 暂停';
  const dialog=currentDialog._expanded||expandDialog(currentDialog);
  playSeq(dialog,0,session);
}

/* ── 模块注册 ── */
window.LJ_MODULES=window.LJ_MODULES||{};
window.LJ_MODULES['learn']={
  init:async function(cfg,icons){
    document.getElementById('panel-learn').innerHTML=`
      <div class="learn-wrap" id="learnList"></div>
      <div id="learnDetail">
        <div class="learn-detail-hero">
          <div class="learn-detail-hero-wrap">
            <div class="learn-detail-hero-bg" id="learnHeroBg"></div>
            <div class="learn-detail-hero-overlay"></div>
            <div class="learn-detail-hero-content">
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

    document.getElementById('learnCtrlBar').innerHTML=`
      <div class="learn-ctrl-row1" id="learnCtrlRow1" style="display:none">
        <div class="learn-ctrl-row1-left">
          <button class="learn-back-ctrl" onclick="closeScene()">←场景选择</button>
        </div>
        <div class="learn-ctrl-row1-mid">
          <button class="learn-play-btn" id="learnPlayBtn" onclick="learnPlay()">▶ 开始演练</button>
          <button class="learn-ctrl-icon" id="learnLoopBtn" onclick="learnToggleLoop()">🔁</button>
          <button class="learn-ctrl-icon rd" onclick="learnStop()">■</button>
          <button class="learn-ctrl-icon sm" id="learnRubyBtn" onclick="learnToggleRuby()">注音</button>
        </div>
        <div class="learn-ctrl-row1-right">
          <button class="learn-familiar-ctrl" id="learnFamiliarCtrl"
                  onclick="toggleFamiliarCtrl()">学会了</button>
        </div>
      </div>
      <div class="learn-ctrl-row2" id="learnCtrlRow2">
        <div class="lseg">
          <button class="btn on" id="lmode-jp"     onclick="learnSetMode('jp')">仅日语</button>
          <button class="btn"    id="lmode-jp_zh"  onclick="learnSetMode('jp_zh')">日→中</button>
          <button class="btn"    id="lmode-repeat" onclick="learnSetMode('repeat')">日→中→日</button>
        </div>
        <div class="lseg">
          <button class="btn"    id="lrate-0.9"  onclick="learnSetRate('0.9')">普通</button>
          <button class="btn on" id="lrate-0.75" onclick="learnSetRate('0.75')">慢</button>
          <button class="btn"    id="lrate-0.6"  onclick="learnSetRate('0.6')">更慢</button>
        </div>
        <div class="lseg">
          <button class="btn on" id="learnFollowOff" onclick="learnSetFollow(false)">连续</button>
          <button class="btn"    id="learnFollowOn"  onclick="learnSetFollow(true)">跟读</button>
        </div>
      </div>`;

    await learnBoot();
  }
};

/* ── 跟读/连续（seg版）── */
function learnSetFollow(val){
  learnFollowMode=val;
  const off=document.getElementById('learnFollowOff');
  const on=document.getElementById('learnFollowOn');
  if(off) off.classList.toggle('on',!val);
  if(on)  on.classList.toggle('on',val);
  showToast(val?'跟读模式：每句留白1.5秒':'连续模式：流畅播放',1500);
}