/* ══════════════════════════════
   sos.js — 急救版块逻辑
   Living Japanese v3.0
══════════════════════════════ */

/* ── State ── */
let SECTIONS = [], ICONS = {};
let flat = [], checkedItems = {}, filterUnlearned = {};
let currentSection = -1, prevSection = -1;
let shouldStop = false, loopMode = false, speakSession = 0;
let rubyOn = true, currentMode = 'jp', currentRate = '0.75';
let sceneBarExpanded = false;

/* ── Boot ── */
async function sosBoot(cfg, icons){
  ICONS = icons;
  currentMode = cfg.controls?.defaultMode || 'jp';
  currentRate = cfg.controls?.defaultRate || '0.75';

  loadStorage();

  try {
    const data = await fetch('data/sos/sentences_core.json').then(r=>r.json());
    SECTIONS = data.sections;

    // Sort by priority
    const order = cfg.sceneBar?.priorityOrder || [];
    SECTIONS.sort((a,b)=>{
      const ia=order.indexOf(a.title), ib=order.indexOf(b.title);
      if(ia===-1&&ib===-1) return 0;
      if(ia===-1) return 1; if(ib===-1) return -1;
      return ia-ib;
    });

    buildFlat();
    renderBanner(cfg.banner);
    renderCtrlSettings(cfg.controls);
    renderSceneBar();
    renderContent(currentSection>=0&&currentSection<SECTIONS.length?currentSection:-1);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('ctrlBar').style.display = '';

    setTimeout(()=>{
      const hdr = document.getElementById('header');
      if(hdr) document.querySelector('main').style.paddingTop = hdr.offsetHeight+'px';
    }, 100);

  } catch(e){
    document.getElementById('loading').textContent = '加载失败，请检查 data/sentences_core.json';
    console.error(e);
  }
}

/* ── Storage ── */
function loadStorage(){
  try{ checkedItems=JSON.parse(localStorage.getItem('lj_checked')||'{}'); }catch(e){ checkedItems={}; }
  try{ const s=localStorage.getItem('lj_sec'); if(s!==null) currentSection=parseInt(s); }catch(e){}
}
function saveChecked(){ try{ localStorage.setItem('lj_checked',JSON.stringify(checkedItems)); }catch(e){} }
function saveSec(si){ try{ localStorage.setItem('lj_sec',String(si)); }catch(e){} }

function buildFlat(){
  flat = [];
  SECTIONS.forEach((sec,si)=>sec.items.forEach((item,ii)=>flat.push({si,ii,item})));
}

/* ── Banner ── */
function renderBanner(b){
  b = b || {};
  const total = SECTIONS.reduce((s,sec)=>s+sec.items.length, 0);
  document.getElementById('banner').innerHTML=`
    <div class="banner-inner">
      <div class="banner-left">
        <div class="banner-eyebrow">${esc(b.eyebrow||'')}</div>
        <div class="banner-title">${esc(b.title||'')}</div>
        <div class="banner-pills">
          ${(b.pills||[]).map(p=>`<span class="banner-pill">${esc(p)}</span>`).join('')}
        </div>
      </div>
      <div class="banner-right">
        <div class="banner-stat-num">${total}</div>
        <div class="banner-stat-label">句・完全免费</div>
      </div>
    </div>`;
}

/* ── Controls ── */
function renderCtrlSettings(c){
  c = c || {};
  const modeHtml = `<div class="seg" id="modeGrp">
    ${(c.modes||[]).map(m=>`
      <button class="btn${currentMode===m.id?' on':''}" id="mode-${m.id}"
              onclick="setMode('${m.id}')">${esc(m.label)}</button>`).join('')}
  </div>`;
  const rateHtml = `<div class="seg" id="rateGrp">
    ${(c.rates||[]).map(r=>`
      <button class="btn${currentRate===r.id?' on':''}" id="rate-${r.id}"
              onclick="setRate('${r.id}')">${esc(r.label)}</button>`).join('')}
  </div>`;
  document.getElementById('ctrlSettings').innerHTML = modeHtml + rateHtml;
}

function setMode(m){
  currentMode = m;
  document.querySelectorAll('#modeGrp .btn').forEach(el=>el.classList.remove('on'));
  const el = document.getElementById('mode-'+m);
  if(el) el.classList.add('on');
}
function setRate(r){
  currentRate = r;
  document.querySelectorAll('#rateGrp .btn').forEach(el=>el.classList.remove('on'));
  const el = document.getElementById('rate-'+r);
  if(el) el.classList.add('on');
}

/* ── Scene Bar ── */
function renderSceneBar(){
  const wrap = document.getElementById('sceneTagsWrap');
  wrap.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'stag'+(currentSection===-1?' on':'');
  allBtn.id = 'stag-all'; allBtn.textContent = '全部';
  allBtn.onclick = ()=>showAll();
  wrap.appendChild(allBtn);

  SECTIONS.forEach((sec,si)=>{
    const icon = ICONS[sec.title]||'📖';
    const btn = document.createElement('button');
    btn.className = 'stag'+(currentSection===si?' on':'');
    btn.id = 'stag-'+si;
    btn.innerHTML = `<span class="stag-icon">${icon}</span>${esc(sec.title_zh||sec.title)}`;
    btn.onclick = ()=>showSection(si);
    wrap.appendChild(btn);
  });
}

function updateSceneBar(si){
  document.querySelectorAll('.stag').forEach(t=>t.classList.remove('on'));
  const el = document.getElementById(si===-1?'stag-all':'stag-'+si);
  if(el) el.classList.add('on');
}

function toggleSceneBar(){
  sceneBarExpanded = !sceneBarExpanded;
  const wrap  = document.getElementById('sceneTagsWrap');
  const arrow = document.getElementById('stoggleArrow');
  wrap.classList.toggle('expanded', sceneBarExpanded);
  arrow.textContent = sceneBarExpanded ? '▲' : '▼';
  setTimeout(()=>{
    const hdr = document.getElementById('header');
    if(hdr) document.querySelector('main').style.paddingTop = hdr.offsetHeight+'px';
  }, 350);
}

/* ── Ruby ── */
function isKJ(ch){
  const c = ch.codePointAt(0);
  return (c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||
         (c>=0xF900&&c<=0xFAFF)||c===0x3005;
}
function rubyHtml(jp, fg){
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
  let fp=0, h='';
  for(let s=0;s<segs.length;s++){
    const sg=segs[s];
    if(!sg.k){
      const idx=fg.indexOf(sg.t,fp); if(idx!==-1) fp=idx+sg.t.length;
      h+=esc(sg.t);
    } else {
      let fe=fg.length;
      if(s+1<segs.length){ const idx=fg.indexOf(segs[s+1].t,fp); if(idx!==-1) fe=idx; }
      const rd=fg.slice(fp,fe); fp=fe;
      h+=rd?`<ruby>${esc(sg.t)}<rt>${esc(rd)}</rt></ruby>`:esc(sg.t);
    }
  }
  return h;
}

function toggleRuby(){
  rubyOn = !rubyOn;
  document.body.classList.toggle('no-ruby', !rubyOn);
  const btn = document.getElementById('btnRuby');
  if(btn){ btn.classList.toggle('on', !rubyOn); }
}

/* ── Progress ── */
function getProg(si){
  const sec=SECTIONS[si], total=sec.items.length;
  const done=sec.items.filter((_,ii)=>checkedItems[`${si}-${ii}`]).length;
  return{done,total};
}

/* ── Render Content ── */
function renderContent(fsi){
  currentSection = fsi; saveSec(fsi);
  const wrap = document.getElementById('content');
  let gn=1; const nums=[];
  SECTIONS.forEach((sec,si)=>sec.items.forEach((_,ii)=>nums.push({si,ii,n:gn++})));

  const toShow = fsi===-1
    ? SECTIONS.map((s,i)=>({sec:s,si:i}))
    : [{sec:SECTIONS[fsi],si:fsi}];

  wrap.innerHTML = toShow.map(({sec,si})=>{
    const {done,total} = getProg(si);
    const pct = total ? Math.round(done/total*100) : 0;
    const filtered = !!filterUnlearned[si];
    const allDone  = done===total && total>0;
    const visible  = sec.items.filter((_,ii)=>!filtered||!checkedItems[`${si}-${ii}`]);

    const cards = visible.map(item=>{
      const ii = sec.items.indexOf(item);
      const n  = (nums.find(x=>x.si===si&&x.ii===ii)||{}).n||'';
      const isDone = !!checkedItems[`${si}-${ii}`];
      return`<div class="card${isDone?' done':''}" id="card-${si}-${ii}">
        <div class="card-num">${n}</div>
        <div class="jp">${rubyHtml(item.jp,item.furigana)}</div>
        <div class="zh">${esc(item.zh)}</div>
        <div class="card-btns">
          <button class="btn sm" onclick="speakOne(${si},${ii})">▶ 朗读</button>
          <button class="btn sm" onclick="speakJp(${si},${ii})">▶ 仅日语</button>
          <button class="lbtn${isDone?' on':''}" onclick="toggleDone(${si},${ii})"
                  id="lb-${si}-${ii}">${isDone?'✓ 学会了':'学会了'}</button>
        </div>
      </div>`;
    }).join('');

    const nextSi = si+1<SECTIONS.length ? si+1 : -1;
    const doneBanner = allDone&&!filtered ? `
      <div class="done-banner">
        <div class="done-banner-em">🎉</div>
        <div class="done-banner-txt">本章全部学完了！</div>
        ${nextSi>=0?`<button class="btn dk sm" onclick="showSection(${nextSi})">下一章 →</button>`:''}
      </div>` : '';

    return`<div class="sec-block" id="sec-${si}">
      <div class="sec-head">
        <div class="sec-stripe"></div>
        <div class="sec-meta">
          <div class="sec-eyebrow">${esc(sec.category)}</div>
          <div class="sec-ja">${esc(sec.title)}</div>
          <div class="sec-zh">${esc(sec.title_zh||'')}</div>
          ${sec.description?`<div class="sec-desc">${esc(sec.description)}</div>`:''}
          <div class="sec-prog-row">
            <span class="sec-prog-text" id="pt-${si}">${done} / ${total} 句</span>
            <div class="prog-track">
              <div class="prog-fill" id="pb-${si}" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="sec-btns">
        <button class="btn dk sm" onclick="speakSec(${si})">▶ 朗读本章</button>
        <button class="btn sm" id="lp-${si}" onclick="toggleLoopSec(${si})">🔁 循环</button>
        <button class="btn rd sm" onclick="stopSpeech()">■ 停止</button>
        <button class="ftoggle${filtered?' on':''}" onclick="toggleFilter(${si})" id="ft-${si}">
          <span class="ftdot">${filtered?'✓':''}</span>
          <span>${filtered?'只看未学（点击显示全部）':'只看未学'}</span>
        </button>
      </div>
      ${doneBanner}
      ${cards||'<p style="color:var(--t4);padding:10px 0;font-size:13px">🎉 全部已学完！</p>'}
    </div>`;
  }).join('');

  updateSceneBar(fsi);
}

/* ── Show / All ── */
function showSection(si){
  stopSpeech(); clearSrch(); renderContent(si);
  setTimeout(()=>{
    const el = document.querySelector('#content .sec-block');
    if(el){
      const h = document.getElementById('header').offsetHeight+8;
      window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-h, behavior:'smooth'});
    }
  }, 60);
  showToast(SECTIONS[si].title_zh||SECTIONS[si].title);
  if(window.gtag) gtag('event','view_section',{section_title:SECTIONS[si].title});
}

function showAll(){
  stopSpeech(); clearSrch();
  currentSection=-1; saveSec(-1);
  renderContent(-1); window.scrollTo({top:0, behavior:'smooth'});
}

/* ── Filter ── */
function toggleFilter(si){
  filterUnlearned[si] = !filterUnlearned[si];
  renderContent(currentSection);
  setTimeout(()=>{
    const el = document.getElementById(`sec-${si}`);
    if(el){
      const h = document.getElementById('header').offsetHeight+8;
      window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-h, behavior:'smooth'});
    }
  }, 60);
}

/* ── Learned ── */
function toggleDone(si,ii){
  const key = `${si}-${ii}`;
  checkedItems[key] = !checkedItems[key];
  if(!checkedItems[key]) delete checkedItems[key];
  saveChecked();
  const isDone = !!checkedItems[key];
  const isFiltered = !!filterUnlearned[si];

  if(isFiltered && isDone){
    const card = document.getElementById(`card-${si}-${ii}`);
    if(card){
      card.style.transition = 'opacity .3s,transform .3s';
      card.style.opacity = '0'; card.style.transform = 'translateX(18px)';
      setTimeout(()=>{
        if(card.parentNode) card.parentNode.removeChild(card);
        updateProgUI(si); checkAllDone(si);
      }, 300);
    }
  } else if(isFiltered && !isDone){
    renderContent(currentSection);
  } else {
    const card = document.getElementById(`card-${si}-${ii}`);
    const lb   = document.getElementById(`lb-${si}-${ii}`);
    if(card) card.classList.toggle('done', isDone);
    if(lb){ lb.classList.toggle('on',isDone); lb.textContent=isDone?'✓ 学会了':'学会了'; }
    updateProgUI(si); checkAllDone(si);
  }
}

function updateProgUI(si){
  const {done,total} = getProg(si);
  const pct = total ? Math.round(done/total*100) : 0;
  const pt = document.getElementById(`pt-${si}`);
  const pb = document.getElementById(`pb-${si}`);
  if(pt) pt.textContent = `${done} / ${total} 句`;
  if(pb) pb.style.width = pct+'%';
}

function checkAllDone(si){
  const {done,total} = getProg(si);
  if(done===total && total>0) setTimeout(()=>renderContent(currentSection), 350);
}

/* ── Search ── */
document.getElementById('searchInput').addEventListener('input',function(){
  const q = this.value.trim();
  if(!q){ clearSearch(); return; }
  prevSection = currentSection; doSearch(q);
});

function doSearch(q){
  stopSpeech();
  const banner = document.querySelector('#panel-sos #banner');
  if(banner) banner.style.display = 'none';
  const lower = q.toLowerCase(); let total=0, html='';
  SECTIONS.forEach((sec,si)=>{
    const hits = sec.items.filter(item=>
      item.jp.includes(q)||item.zh.includes(q)||
      (item.furigana&&item.furigana.includes(q))||
      item.zh.toLowerCase().includes(lower));
    if(!hits.length) return;
    total += hits.length;
    html += `<div class="srch-sec">${esc(sec.title_zh||sec.title)}</div>`;
    hits.forEach(item=>{
      const ii = sec.items.indexOf(item);
      html += `<div class="card">
        <div class="jp">${hlTxt(item.jp,q)}</div>
        <div class="zh">${hlTxt(item.zh,q)}</div>
        <div class="card-btns">
          <button class="btn sm" onclick="speakOne(${si},${ii})">▶ 朗读</button>
          <button class="btn sm" onclick="speakJp(${si},${ii})">▶ 仅日语</button>
        </div>
      </div>`;
    });
  });
  document.getElementById('content').innerHTML=`
    <div class="srch-header">「${esc(q)}」的搜索结果：${total}句</div>
    ${html||'<p style="color:var(--t4);padding:20px 0;font-size:13px">没有找到相关句子。</p>'}`;
  updateSceneBar(-2);
}

function hlTxt(t,q){
  const e=esc(t), eq=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return e.replace(new RegExp(eq,'gi'),m=>`<mark>${m}</mark>`);
}

function clearSrch(){
  document.getElementById('searchInput').value='';
  const banner = document.querySelector('#panel-sos #banner');
  if(banner) banner.style.display='';
}
function clearSearch(){
  clearSrch(); renderContent(prevSection);
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ── Speech ── */
function getModeTexts(item){
  if(currentMode==='jp')     return [{t:item.jp, l:'ja-JP', v:jaVoice}];
  if(currentMode==='jp_zh')  return [{t:item.jp, l:'ja-JP', v:jaVoice},{t:item.zh, l:'zh-CN', v:zhVoice}];
  return [{t:item.jp,l:'ja-JP',v:jaVoice},{t:item.zh,l:'zh-CN',v:zhVoice},{t:item.jp,l:'ja-JP',v:jaVoice}];
}

function getSpeakable(si){
  const sec=SECTIONS[si], filt=!!filterUnlearned[si];
  return sec.items.map((item,ii)=>({item,ii})).filter(({ii})=>!filt||!checkedItems[`${si}-${ii}`]);
}

function speak(segs, onEnd, session){
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    let i=0;
    function next(){
      if(shouldStop||speakSession!==session) return;
      if(i>=segs.length){ if(onEnd) onEnd(); return; }
      const sg=segs[i++];
      const u=new SpeechSynthesisUtterance(sg.t);
      u.lang=sg.l; u.rate=parseFloat(currentRate); u.pitch=1;
      if(sg.v) u.voice=sg.v;
      u.onend=()=>setTimeout(next,350);
      u.onerror=()=>setTimeout(next,100);
      window.speechSynthesis.speak(u);
    }
    next();
  }, 80);
}

function hlCard(si,ii){
  document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
  const el = document.getElementById(`card-${si}-${ii}`);
  if(el){ el.classList.add('playing'); el.scrollIntoView({behavior:'smooth',block:'center'}); }
}

function speakOne(si,ii){
  shouldStop=false; speakSession++;
  const s=speakSession; hlCard(si,ii);
  speak(getModeTexts(SECTIONS[si].items[ii]), null, s);
}
function speakJp(si,ii){
  shouldStop=false; speakSession++;
  const s=speakSession; hlCard(si,ii);
  speak([{t:SECTIONS[si].items[ii].jp,l:'ja-JP',v:jaVoice}], null, s);
}

function speakSec(si){
  shouldStop=false; speakSession++;
  const session=speakSession;
  const items=getSpeakable(si);
  if(!items.length){ showToast('没有未学的句子了 🎉',2000); return; }
  speakSecItems(si,items,0,session);
}

function speakSecItems(si,items,idx,session){
  if(shouldStop||speakSession!==session) return;
  if(idx>=items.length){
    document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
    if(loopMode){
      showToast('🔁 循环播放中…',1500);
      setTimeout(()=>{
        if(!shouldStop&&speakSession===session)
          speakSecItems(si,getSpeakable(si),0,session);
      },800);
    } else {
      showToast('✓ 朗读完毕',2200);
    }
    return;
  }
  const {item,ii}=items[idx];
  hlCard(si,ii);
  speak(getModeTexts(item),()=>setTimeout(()=>speakSecItems(si,items,idx+1,session),450),session);
}

function speakAll(){
  shouldStop=false; speakSession++;
  const session=speakSession;
  showToast('开始朗读…');
  let list=[];
  SECTIONS.forEach((sec,si)=>{
    if(currentSection!==-1&&si!==currentSection) return;
    getSpeakable(si).forEach(({item,ii})=>list.push({si,ii,item}));
  });
  if(!list.length){ showToast('没有未学的句子了 🎉',2000); return; }
  speakList(list,0,session);
}

function speakList(list,idx,session){
  if(shouldStop||speakSession!==session) return;
  if(idx>=list.length){
    document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
    showToast('✓ 全部朗读完毕',2200); return;
  }
  const {si,ii,item}=list[idx];
  hlCard(si,ii);
  speak(getModeTexts(item),()=>setTimeout(()=>speakList(list,idx+1,session),450),session);
}

function toggleLoop(){
  loopMode=!loopMode;
  const btn=document.getElementById('btnLoop');
  if(btn) btn.classList.toggle('on',loopMode);
  showToast(loopMode?'循环播放已开启':'循环播放已关闭',1500);
}

function toggleLoopSec(si){
  const btn=document.getElementById(`lp-${si}`);
  const isOn=btn?.classList.contains('on');
  document.querySelectorAll('[id^="lp-"]').forEach(el=>{
    el.classList.remove('on'); el.textContent='🔁 循环';
  });
  if(isOn){
    loopMode=false; stopSpeech();
  } else {
    loopMode=true;
    if(btn){ btn.classList.add('on'); btn.textContent='🔁 循环中'; }
    const synth=window.speechSynthesis;
    if(!synth.speaking&&!synth.paused){
      shouldStop=false; speakSession++;
      const session=speakSession;
      const items=getSpeakable(si);
      if(!items.length){ showToast('没有未学的句子了 🎉',2000); return; }
      speakSecItems(si,items,0,session);
    } else {
      showToast('🔁 循环已开启，播完后自动重复',2000);
    }
  }
}

function pauseOrResume(){
  const synth=window.speechSynthesis;
  const btn=document.getElementById('btnPause');
  if(synth.speaking&&!synth.paused){
    synth.pause();
    if(btn){ btn.textContent='▶'; btn.classList.add('on'); }
  } else if(synth.paused){
    synth.resume();
    if(btn){ btn.textContent='⏸'; btn.classList.remove('on'); }
  }
}

function stopSpeech(){
  shouldStop=true; speakSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
  const bp=document.getElementById('btnPause');
  if(bp){ bp.textContent='⏸'; bp.classList.remove('on'); }
  if(loopMode){
    loopMode=false;
    const bl=document.getElementById('btnLoop');
    if(bl) bl.classList.remove('on');
    document.querySelectorAll('[id^="lp-"]').forEach(el=>{
      el.classList.remove('on'); el.textContent='🔁 循环';
    });
  }
  const bs=document.getElementById('btnStop');
  if(bs){ bs.classList.add('stopped'); setTimeout(()=>bs.classList.remove('stopped'),1200); }
}
