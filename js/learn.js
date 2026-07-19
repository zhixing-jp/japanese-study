/* ══════════════════════════════
   learn.js — 学习版块逻辑 v6
   Living Japanese v3.0
══════════════════════════════ */

/* ── State ── */
let LEARN_INDEX   = null;
let LEARN_CACHE   = {};
let learnFamiliar = {};
let currentScene  = null;
let currentDialog = [];
let currentExtId  = null;
let learnShouldStop = false;
let learnSession    = 0;
let learnLoopMode   = false;
let currentAudio    = null;
let learnRubyOn     = true;
let learnMode       = 'jp';
let learnRate       = '0.75';

const DEFAULT_STAFF_AVATAR = '👨‍💼';
const DEFAULT_USER_AVATAR  = '🧑';

/* ── 〇〇替换词库 ── */
const LR = {
  station: ['大阪','梅田','難波','天王寺','心斎橋','京橋','鶴橋','新大阪'],
  price:   ['980','1,200','350','2,500','680','1,050'],
  name:    ['田中','山田','佐藤','鈴木','中村'],
  time:    ['10時','14時30分','18時','9時半'],
  date:    ['7月20日','8月1日'],
  line:    ['1番線','2番線','3番線'],
  place:   ['道頓堀','心斎橋','天満','本町']
};
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function replaceOO(text){
  if(!text) return text;
  return text
    .replace(/○○駅/g,     ()=>pick(LR.station)+'駅')
    .replace(/○○行き/g,   ()=>pick(LR.station)+'行き')
    .replace(/○○まで/g,   ()=>pick(LR.station)+'まで')
    .replace(/○○に行きますか/g, ()=>pick(LR.station)+'に行きますか')
    .replace(/○○で降ります/g,   ()=>pick(LR.station)+'で降ります')
    .replace(/○○はまだですか/g, ()=>pick(LR.station)+'はまだですか')
    .replace(/○○へはどこで/g,   ()=>pick(LR.station)+'へはどこで')
    .replace(/○○に止まりますか/g,()=>pick(LR.station)+'に止まりますか')
    .replace(/○番線/g,    ()=>pick(LR.line))
    .replace(/○○円/g,    ()=>pick(LR.price)+'円')
    .replace(/○時○分/g,  ()=>pick(LR.time))
    .replace(/○月○日/g,  ()=>pick(LR.date))
    .replace(/○○と申します/g, ()=>pick(LR.name)+'と申します')
    .replace(/○○です。/g,  ()=>pick(LR.name)+'です。')
    .replace(/○○/g,      ()=>pick(LR.place));
}

/* ── 振假名 ── */
function isKJ(ch){
  const c=ch.codePointAt(0);
  return(c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||
        (c>=0xF900&&c<=0xFAFF)||c===0x3005;
}
function buildRuby(jp, fg){
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
function jpHtml(jp, fg){
  if(!jp) return '';
  if(!learnRubyOn) return esc(jp);
  return buildRuby(jp, fg||jp);
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
  if(sc._comingSoon) return `
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
  return`<div class="learn-scene-card ${sc2}${!hasBg?' no-image':''}" onclick="openScene('${id}')">
    ${si?`<div class="learn-scene-status">${si}</div>`:''}
    <div class="learn-scene-bg"${hasBg?` style="background-image:url('${sc.image}')"`:''}></div>
    <div class="learn-scene-overlay"></div>
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
  document.getElementById('learnDetail').classList.add('on');
  document.getElementById('learnCtrlBar').classList.add('on');
  renderSceneDetail();
  playSceneSound(currentScene);
  // 滚动时隐藏/显示Hero
  const dw=document.getElementById('learnDialogWrap');
  if(dw){
    dw.onscroll=function(){
      const hero=document.querySelector('.learn-detail-hero');
      if(!hero) return;
      hero.classList.toggle('collapsed', this.scrollTop>40);
    };
  }
}

function closeScene(){
  learnStop();
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  // 重置Hero
  const hero=document.querySelector('.learn-detail-hero');
  if(hero) hero.classList.remove('collapsed');
  // 清除滚动监听
  const dw=document.getElementById('learnDialogWrap');
  if(dw) dw.onscroll=null;
  currentScene=null; currentExtId=null; currentDialog=[];
  document.getElementById('learnList').style.display='';
  document.getElementById('learnDetail').classList.remove('on');
  document.getElementById('learnCtrlBar').classList.add('on');
  // ctrlbar切回列表模式（隐藏场景内按钮）
  updateCtrlBar(false);
  renderLearnList();
}

/* ── Controls Bar状态切换 ── */
function updateCtrlBar(inScene){
  const row1=document.getElementById('learnCtrlRow1');
  const row2=document.getElementById('learnCtrlRow2');
  if(row1) row1.style.display=inScene?'':'none';
  if(row2) row2.style.display='flex';
}

/* ── 渲染场景详情 ── */
function renderSceneDetail(){
  if(!currentScene) return;
  // Hero背景
  const heroBg=document.getElementById('learnHeroBg');
  if(heroBg){
    if(currentScene.image){
      heroBg.style.backgroundImage=`url('${currentScene.image}')`;
    } else {
      heroBg.style.backgroundImage='';
    }
  }
  // 场景名+说明
  const nameEl=document.getElementById('learnDetailSceneName');
  if(nameEl) nameEl.textContent=currentScene.title||'';
  const descEl=document.getElementById('learnDetailSceneDesc');
  if(descEl) descEl.textContent=currentScene.description||'';
  // 更新ctrlbar按钮
  updateCtrlBar(true);
  const fb=document.getElementById('learnFamiliarCtrl');
  const isFam=!!learnFamiliar[currentScene.id];
  if(fb){fb.classList.toggle('on',isFam);fb.textContent=isFam?'✓ 已熟悉':'标记已熟悉';}
  // 扩展会话
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

/* ── 展开对话（备选项拆分+note归属）── */
function expandDialog(dialog){
  const out=[];
  dialog.forEach(d=>{
    const jpParts=(d.jp||'').split('／').map(s=>s.trim()).filter(Boolean);
    const zhParts=(d.zh||'').split('／').map(s=>s.trim());
    const fgParts=(d.furigana||'').split('／').map(s=>s.trim());
    if(jpParts.length>1){
      // 主项
      out.push({...d, jp:jpParts[0], zh:zhParts[0]||'', furigana:fgParts[0]||''});
      // 备选项
      jpParts.slice(1).forEach((jp,i)=>{
        out.push({
          speaker: d.speaker, jp,
          zh: zhParts[i+1]||'',
          furigana: fgParts[i+1]||'',
          pause: d.pause, _isAlt: true
        });
      });
    } else {
      out.push({...d});
    }
    // 对方说的有note → 自动加你的动作气泡
    if(d.speaker==='them'&&d.note){
      out.push({
        speaker:'you', jp:'', zh:'', furigana:'',
        note:d.note, pause:1500, _isActionOnly:true
      });
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
    // 替换〇〇
    const jpRaw=replaceOO(d.jp)||'';
    const fgRaw=replaceOO(d.furigana)||'';
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
  // 滚回顶部确保Hero可见
  wrap.scrollTop=0;
}

/* ── 注音切换 ── */
function learnToggleRuby(){
  learnRubyOn=!learnRubyOn;
  const btn=document.getElementById('learnRubyBtn');
  if(btn) btn.classList.toggle('on',!learnRubyOn);
  if(currentScene) renderDialog();
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
  if(fb){fb.classList.add('on');fb.textContent='✓ 已熟悉';}
  const banner=document.getElementById('learnDoneBanner');
  if(banner){
    const btns=banner.querySelector('.learn-done-btns');
    if(btns) btns.innerHTML=`<button class="btn sm" onclick="learnReplay()">▶ 再听一遍</button>`;
  }
  showToast('✓ 已标记为熟悉',1800);
}
function toggleFamiliarCtrl(){
  if(!currentScene) return;
  if(learnFamiliar[currentScene.id]){
    delete learnFamiliar[currentScene.id];
    const fb=document.getElementById('learnFamiliarCtrl');
    if(fb){fb.classList.remove('on');fb.textContent='标记已熟悉';}
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

function getTexts(d){
  const jp=replaceOO(d.jp)||'';
  const zh=d.zh||'';
  if(learnMode==='jp')     return [{t:jp,l:'ja-JP',v:jaVoice}];
  if(learnMode==='jp_zh')  return [{t:jp,l:'ja-JP',v:jaVoice},{t:zh,l:'zh-CN',v:zhVoice}];
  return [{t:jp,l:'ja-JP',v:jaVoice},{t:zh,l:'zh-CN',v:zhVoice},{t:jp,l:'ja-JP',v:jaVoice}];
}

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
  // 动作气泡不朗读
  if(d._isActionOnly||d.speaker==='action'||(!d.jp&&d.note)){
    setTimeout(()=>playSeq(dialog,idx+1,session),d.pause||1500); return;
  }
  const segs=getTexts(d).filter(s=>s.t);
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    if(learnShouldStop||learnSession!==session) return;
    let si=0;
    function nextSeg(){
      if(learnShouldStop||learnSession!==session) return;
      if(si>=segs.length){
        setTimeout(()=>playSeq(dialog,idx+1,session),d.pause||(d.speaker==='you'?2500:1500));
        return;
      }
      const sg=segs[si++];
      const u=new SpeechSynthesisUtterance(sg.t);
      u.lang=sg.l; u.rate=parseFloat(learnRate); u.pitch=1;
      if(sg.v) u.voice=sg.v;
      u.onend=()=>setTimeout(nextSeg,300);
      u.onerror=()=>setTimeout(nextSeg,100);
      window.speechSynthesis.speak(u);
    }
    nextSeg();
  },80);
}

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
      <div class="learn-ctrl-row1" id="learnCtrlRow1">
        <button class="learn-back-ctrl" onclick="closeScene()">← 返回</button>
        <button class="learn-play-btn" id="learnPlayBtn" onclick="learnPlay()">▶ 开始演练</button>
        <button class="learn-ctrl-icon" id="learnLoopBtn" onclick="learnToggleLoop()">🔁</button>
        <button class="learn-ctrl-icon rd" onclick="learnStop()">■</button>
        <button class="learn-familiar-ctrl" id="learnFamiliarCtrl"
                onclick="toggleFamiliarCtrl()">标记已熟悉</button>
      </div>
      <div class="learn-ctrl-row2" id="learnCtrlRow2">
        <button class="learn-ctrl-icon sm" id="learnRubyBtn"
                onclick="learnToggleRuby()">注音</button>
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
      </div>`;

    // 初始状态：隐藏场景内按钮
    updateCtrlBar(false);
    await learnBoot();
  }
};
