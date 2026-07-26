/* ══════════════════════════════
   sos.js — 急救版块逻辑 v2
   Living Japanese v3.0
   三层结构：首页→场景→内容
══════════════════════════════ */

/* ── 场景色盘（12色循环）── */
const SOS_COLORS = [
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
function getSosColor(idx){ return SOS_COLORS[idx % SOS_COLORS.length]; }

/* ── State ── */
let SECTIONS = [], ICONS = {};
let SOS_INDEX = null;
let SCENE_META = [];
let SOS_CACHE = {};            // 已加载的场景数据缓存
let currentSosView = 'home';   // home | content
let currentSosSection = -1;    // 当前场景索引
let currentSceneData = null;   // 当前场景完整数据
let currentSubcat = null;      // 当前二级分类ID
let checkedItems = {};
let filterUnlearned = false;
let shouldStop = false, loopMode = false, speakSession = 0;
let rubyOn = true, currentMode = 'jp', currentRate = '0.75';

/* ── Boot ── */
async function sosBoot(cfg, icons){
  ICONS = icons;
  currentMode = cfg.controls?.defaultMode || 'jp';
  currentRate = cfg.controls?.defaultRate  || '0.75';
  loadSosStorage();

  try{
    // 加载index.json获取场景目录
    const index = await fetch('data/sos/index.json').then(r=>r.json());
    SOS_INDEX = index;
    SCENE_META = index.scenes;

    // 并行加载所有场景，自动同步count
    await Promise.all(SCENE_META.map(async (sc, si) => {
      try {
        const data = await fetch(sc.file).then(r=>r.json());
        SOS_CACHE[si] = data;
        sc.count = data.items.length;
      } catch(e) { console.warn('场景加载失败:', sc.file); }
    }));

    renderSosBanner(cfg.banner);
    renderSosHome();
    renderCtrlBar(cfg.controls);
    showSosHome();

    // History API：让浏览器返回键在版块内层级间导航
    history.replaceState({panel:'sos',view:'home'},'','');
    window.addEventListener('popstate',(e)=>{
      // 只处理sos版块的state
      const st=e.state;
      if(!st||st.panel!=='sos') return;
      stopSpeech();
      if(st.view==='home'){
        showSosHome(true);
      } else if(st.view==='scene'){
        currentSubcat=null;
        filterUnlearned=false;
        currentSosSection=st.si;
        currentSceneData=SOS_CACHE[st.si];
        showSosDetail(st.si);
      } else if(st.view==='subcat'){
        currentSubcat=st.subcatId;
        currentSosSection=st.si;
        currentSceneData=SOS_CACHE[st.si];
        document.getElementById('ctrlBar').classList.add('on');
        updateCtrlBarMode('content');
        renderSubcatBar(st.si);
        renderSosContent(st.si,st.subcatId);
      }
    });

    document.getElementById('loading').style.display='none';

    setTimeout(()=>{
      const hdr=document.getElementById('header');
      if(hdr) document.querySelector('main').style.paddingTop=hdr.offsetHeight+'px';
    },100);

  }catch(e){
    document.getElementById('loading').textContent='加载失败，请检查 data/sos/index.json';
    console.error(e);
  }
}

/* ── Storage ── */
function loadSosStorage(){
  try{ checkedItems=JSON.parse(localStorage.getItem('lj_checked')||'{}'); }catch(e){ checkedItems={}; }
}
function saveSosStorage(){
  try{ localStorage.setItem('lj_checked',JSON.stringify(checkedItems)); }catch(e){}
}

/* ── Banner ── */
function renderSosBanner(b){
  b=b||{};
  const total=SCENE_META.reduce((s,sc)=>s+(sc.count||0),0);
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

/* ── 场景首页 ── */
function renderSosHome(){
  const wrap=document.getElementById('sosSceneGrid');
  if(!wrap||!SCENE_META) return;
  wrap.innerHTML=SCENE_META.map((sc,si)=>{
    const icon=ICONS[sc.title]||'📖';
    const hasBg=!!sc.image;
    const [c1,c2]=getSosColor(si);
    const bgStyle=hasBg
      ?`background-image:url('${sc.image}')`
      :`background:linear-gradient(135deg,${c1} 0%,${c2} 100%)`;
    return`<div class="sos-scene-card" onclick="openSosScene(${si})">
      <div class="sos-scene-bg" style="${bgStyle}"></div>
      <div class="sos-scene-overlay"${hasBg?'':' style="display:none"'}></div>
      <div class="sos-scene-content">
        <div class="sos-scene-emoji">${icon}</div>
        <div class="sos-scene-title">${esc(sc.title_zh||sc.title)}</div>
        <div class="sos-scene-count">${sc.count}句</div>
      </div>
    </div>`;
  }).join('');
}

/* ── 打开场景 ── */
async function openSosScene(si){
  currentSosSection=si;
  currentSubcat=null;
  filterUnlearned=false;
  stopSpeech();

  // 按需加载场景数据
  if(!SOS_CACHE[si]){
    const meta=SCENE_META[si];
    try{
      const data=await fetch(meta.file).then(r=>r.json());
      SOS_CACHE[si]=data;
    }catch(e){
      showToast('场景加载失败',2000); return;
    }
  }
  currentSceneData=SOS_CACHE[si];
  history.pushState({panel:'sos',view:'scene',si},'','');
  showSosDetail(si);
}

/* ── 视图切换 ── */
function showSosHome(fromPopstate){
  if(!fromPopstate) history.replaceState({panel:'sos',view:'home'},'','');
  currentSosView='home';
  const home=document.getElementById('sosHome');
  home.style.display='';
  home.style.animation='none';
  requestAnimationFrame(()=>{ home.style.animation='fadeIn .2s ease-out'; });
  document.getElementById('sosDetail').classList.remove('on');
  document.getElementById('ctrlBar').classList.remove('on');
  document.querySelector('main').classList.remove('has-ctrl');
  // 隐藏搜索框场景Bar
  const sbw=document.getElementById('sceneBarWrap');
  const sw=document.getElementById('searchWrap');
  if(sbw) sbw.style.display='none';
  if(sw)  sw.style.display='none';
  updateCtrlBarMode('home');
  window.scrollTo({top:0,behavior:'smooth'});
}

function showSosDetail(si){
  currentSosView='content';
  document.getElementById('sosHome').style.display='none';
  document.getElementById('sosDetail').classList.add('on');
  document.querySelector('main').classList.add('has-ctrl');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{
    const hdr=document.getElementById('header');
    if(hdr) document.querySelector('main').style.paddingTop=hdr.offsetHeight+'px';
  },50);

  const meta=SCENE_META[si]||{};
  const subcats=meta.subcategories||[];

  if(subcats.length && !currentSubcat){
    // 显示场景首页：场景名 + 二级分类大按钮
    document.getElementById('ctrlBar').classList.remove('on');
    updateCtrlBarMode('home');
    renderSceneLanding(si);
  } else {
    // 直接显示语句列表
    document.getElementById('ctrlBar').classList.add('on');
    updateCtrlBarMode('content');
    renderSubcatBar(si);
    renderSosContent(si, currentSubcat);
  }
}

/* ── 场景Landing页（场景名+二级分类大按钮）── */
function renderSceneLanding(si){
  const meta=SCENE_META[si]||{};
  const subcats=meta.subcategories||[];
  const wrap=document.getElementById('sosContentWrap');
  const bar=document.getElementById('sosSubcatBar');
  if(bar) bar.style.display='none';
  if(!wrap) return;

  const [lc1,lc2]=getSosColor(si);
  wrap.innerHTML=`
    <div class="sos-scene-landing">
      <div class="sos-landing-hero" style="background:linear-gradient(135deg,${lc1} 0%,${lc2} 100%)">
        <button class="sos-landing-back" onclick="showSosHome()">← 场景选择</button>
        <div class="sos-landing-title-hero">${esc(meta.title_zh||meta.title)}</div>
        <div class="sos-landing-desc-hero">${esc(meta.description||'')}</div>
      </div>
      <div class="sos-landing-desc" style="display:none">${esc(meta.description||'')}</div>
      ${(meta.info&&meta.info.length)?`
      <div class="scene-info-wrap" onclick="
        const info=this.querySelector('.scene-info');
        const btn=this.querySelector('.scene-info-toggle');
        info.classList.toggle('expanded');
        btn.textContent=info.classList.contains('expanded')?'∧∧点击折叠∧∧':'∨∨点击打开∨∨';
      ">
        <div class="scene-info" id="scene-info-${si}">
          ${meta.info.map(sec=>`
            <div class="scene-info-section">
              <div class="scene-info-title">${esc(sec.title)}</div>
              <div class="scene-info-body">
                ${sec.table ? `
                  <table class="scene-info-table">
                    ${sec.table.map((row,i)=>`
                      <tr class="${i===0?'scene-info-table-header':''}">
                        ${row.map(cell=>`<td>${cell}</td>`).join('')}
                      </tr>`).join('')}
                  </table>
                ` : sec.lines.map(l=>l).join('<br>')}
              </div>
            </div>`).join('')}
        </div>
        <div class="scene-info-toggle">∨∨点击打开∨∨</div>
      </div>
    </div>`:''}
      <div class="sos-landing-grid">
        ${subcats.map(s=>`
          <button class="sos-landing-btn" onclick="selectSubcat('${s.id}',${si})">
            <span class="sos-landing-btn-title">${esc(s.title)}</span>
            <span class="sos-landing-btn-ja">${esc(s.title_ja||'')}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

function selectSubcat(subcatId, si){
  currentSubcat=subcatId;
  history.pushState({panel:'sos',view:'subcat',si,subcatId},'','');
  document.getElementById('ctrlBar').classList.add('on');
  updateCtrlBarMode('content');
  renderSubcatBar(si);
  renderSosContent(si, subcatId);
  // 急救版块已激活时再次点击，返回场景首页
if(name === 'sos' && currentTab === 'sos'){
  if(typeof showSosHome === 'function') showSosHome();
  return;
}
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── 二级分类Bar ── */
function renderSubcatBar(si){
  const meta=SCENE_META[si]||{};
  const bar=document.getElementById('sosSubcatBar');
  if(!bar) return;
  const subcats=meta.subcategories||[];
  if(!subcats.length){
    bar.style.display='none'; return;
  }
  bar.style.display='';
  bar.innerHTML=[
    `<button class="sos-subcat-btn${!currentSubcat?' on':''}"
             onclick="setSubcat(null)">返回</button>`
  ].concat(subcats.map(s=>
    `<button class="sos-subcat-btn${currentSubcat===s.id?' on':''}"
             id="subcat-${s.id}" onclick="setSubcat('${s.id}')">
      ${esc(s.title)}
    </button>`
  )).join('');
}

function setSubcat(id){
  if(!id){
    // 点「全部」返回场景landing
    currentSubcat=null;
    document.getElementById('ctrlBar').classList.remove('on');
    updateCtrlBarMode('home');
    renderSceneLanding(currentSosSection);
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  currentSubcat=id;
  document.getElementById('ctrlBar').classList.add('on');
  updateCtrlBarMode('content');
  renderSubcatBar(currentSosSection);
  renderSosContent(currentSosSection, id);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── 内容渲染 ── */
function renderSosContent(si, subcatId){
  const sec=currentSceneData;
  const wrap=document.getElementById('sosContentWrap');
  if(!wrap||!sec) return;

  // 过滤：二级分类 + 只看未学（staff句始终保留）
  let items=sec.items.map((item,ii)=>({item,ii}));
  if(subcatId){
    items=items.filter(({item})=>item.subcategory===subcatId);
  }
  if(filterUnlearned){
    items=items.filter(({item,ii})=>item.role==='staff'||!checkedItems[`${si}-${ii}`]);
  }

  if(!items.length){
    wrap.innerHTML='<p style="color:var(--t4);padding:20px 0;font-size:13px;text-align:center">🎉 全部已学完！</p>';
    return;
  }

  wrap.innerHTML=items.map(({item,ii})=>{
    const isStaff=item.role==='staff';
    const isDone=!!checkedItems[`${si}-${ii}`];
    return`<div class="card${isDone?' done':''}${isStaff?' is-staff':''}" id="card-${si}-${ii}">
      ${isStaff?'<span class="staff-label">对方可能会问</span>':''}
      <div class="card-top">
        <div class="card-num">${ii+1}</div>
        <div class="card-btns-top">
          <button class="card-play-btn${isStaff?' is-staff-btn':''}" onclick="speakOne(${si},${ii})">${isStaff?'🎧 试听':'▶ 仅日语朗读'}</button>
          ${!isStaff?`<button class="lbtn${isDone?' on':''}" id="lb-${si}-${ii}"
                  onclick="toggleDone(${si},${ii})">${isDone?'✓ 学会了':'学会了'}</button>`:''}
        </div>
      </div>
      <div class="jp">${rubyHtml(item.jp,item.furigana)}</div>
      <div class="zh">${esc(item.zh)}</div>
    </div>`;
  }).join('');
}

/* ── 振假名 ── */
function isKJ(ch){
  const c=ch.codePointAt(0);
  return(c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||
        (c>=0xF900&&c<=0xFAFF)||c===0x3005;
}
function rubyHtml(jp,fg){
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

function toggleRuby(){
  rubyOn=!rubyOn;
  document.body.classList.toggle('no-ruby',!rubyOn);
  const btn=document.getElementById('btnRuby');
  if(btn) btn.classList.toggle('on',!rubyOn);
  if(currentSosView==='content') renderSosContent(currentSosSection,currentSubcat);
}

/* ── 学会了 ── */
function toggleDone(si,ii){
  const key=`${si}-${ii}`;
  checkedItems[key]=!checkedItems[key];
  if(!checkedItems[key]) delete checkedItems[key];
  saveSosStorage();
  const isDone=!!checkedItems[key];
  if(filterUnlearned&&isDone){
    const card=document.getElementById(`card-${si}-${ii}`);
    if(card){
      card.style.transition='opacity .3s,transform .3s';
      card.style.opacity='0'; card.style.transform='translateX(18px)';
      setTimeout(()=>{if(card.parentNode)card.parentNode.removeChild(card);},300);
    }
  } else {
    const card=document.getElementById(`card-${si}-${ii}`);
    const lb=document.getElementById(`lb-${si}-${ii}`);
    if(card) card.classList.toggle('done',isDone);
    if(lb){lb.classList.toggle('on',isDone);lb.textContent=isDone?'✓ 学会了':'学会了';}
  }
}

/* ── 只看未学 ── */
function toggleFilterUnlearned(){
  filterUnlearned=!filterUnlearned;
  const btn=document.getElementById('btnUnlearned');
  if(btn) btn.classList.toggle('on',filterUnlearned);
  renderSosContent(currentSosSection,currentSubcat);
}

/* ── 搜索 ── */
document.addEventListener('DOMContentLoaded',()=>{
  const si=document.getElementById('searchInput');
  if(si) si.addEventListener('input',function(){
    const q=this.value.trim();
    if(!q){ clearSosSearch(); return; }
    doSosSearch(q);
  });
});

function doSosSearch(q){
  stopSpeech();
  document.getElementById('sosHome').style.display='none';
  document.getElementById('sosDetail').classList.add('on');
  document.getElementById('ctrlBar').classList.add('on');
  updateCtrlBarMode('search');
  const lower=q.toLowerCase(); let total=0, html='';
  SECTIONS.forEach((sec,si)=>{
    const hits=sec.items.filter(item=>
      item.jp.includes(q)||item.zh.includes(q)||
      (item.furigana&&item.furigana.includes(q))||
      item.zh.toLowerCase().includes(lower));
    if(!hits.length) return;
    total+=hits.length;
    html+=`<div class="srch-sec">${esc(sec.title_zh||sec.title)}</div>`;
    hits.forEach(item=>{
      const ii=sec.items.indexOf(item);
      html+=`<div class="card">
        <div class="card-top">
          <div class="card-num">${ii+1}</div>
          <div class="card-btns-top">
            <button class="card-play-btn" onclick="speakOne(${si},${ii})">▶ 仅日语朗读</button>
          </div>
        </div>
        <div class="jp">${hlTxt(item.jp,q)}</div>
        <div class="zh">${hlTxt(item.zh,q)}</div>
      </div>`;
    });
  });
  const wrap=document.getElementById('sosContentWrap');
  if(wrap) wrap.innerHTML=`
    <div class="srch-header">「${esc(q)}」的搜索结果：${total}句</div>
    ${html||'<p style="color:var(--t4);padding:20px 0;font-size:13px">没有找到相关句子。</p>'}`;
  const bar=document.getElementById('sosSubcatBar');
  if(bar) bar.style.display='none';
}

function hlTxt(t,q){
  const e=esc(t), eq=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return e.replace(new RegExp(eq,'gi'),m=>`<mark>${m}</mark>`);
}

function clearSosSearch(){
  const si=document.getElementById('searchInput');
  if(si) si.value='';
  if(currentSosView==='content'){
    renderSubcatBar(currentSosSection);
    renderSosContent(currentSosSection,currentSubcat);
    updateCtrlBarMode('content');
  } else {
    showSosHome();
  }
}

/* ── Controls Bar ── */
function renderCtrlBar(c){
  c=c||{};
  const modeHtml=`<div class="cseg">
    ${(c.modes||[]).map(m=>
      `<button class="btn${currentMode===m.id?' on':''}" id="smode-${m.id}"
               onclick="setSosMode('${m.id}')">${esc(m.label)}</button>`
    ).join('')}
  </div>`;
  const rateHtml=`<div class="cseg">
    ${(c.rates||[]).map(r=>
      `<button class="btn${currentRate===r.id?' on':''}" id="srate-${r.id}"
               onclick="setSosRate('${r.id}')">${esc(r.label)}</button>`
    ).join('')}
  </div>`;
  const row2=document.getElementById('ctrlRow2');
  if(row2) row2.innerHTML=modeHtml+rateHtml+`
    <button class="ctrl-icon sm" id="btnRuby" onclick="toggleRuby()">注音</button>`;
}

function updateCtrlBarMode(mode){
  const cb=document.getElementById('ctrlBar');
  if(!cb) return;
  if(mode==='home'){
    cb.classList.remove('on'); return;
  }
  cb.classList.add('on');
  const backBtn=document.getElementById('btnSosBack');
  if(backBtn) backBtn.style.display= mode==='search'?'none':'';
}

function setSosMode(m){
  currentMode=m;
  document.querySelectorAll('[id^="smode-"]').forEach(el=>el.classList.remove('on'));
  const el=document.getElementById('smode-'+m);
  if(el) el.classList.add('on');
}
function setSosRate(r){
  currentRate=r;
  document.querySelectorAll('[id^="srate-"]').forEach(el=>el.classList.remove('on'));
  const el=document.getElementById('srate-'+r);
  if(el) el.classList.add('on');
}

/* ── 朗读 ── */
function getModeTexts(item){
  if(currentMode==='jp')    return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice}];
  if(currentMode==='jp_zh') return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice},{t:item.zh,l:'zh-CN',v:zhVoice}];
  return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice},{t:item.zh,l:'zh-CN',v:zhVoice},{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice}];
}

function speak(segs,onEnd,session){
  window.speechSynthesis.cancel();
  setTimeout(()=>{
    let i=0;
    function next(){
      if(shouldStop||speakSession!==session) return;
      if(i>=segs.length){if(onEnd)onEnd();return;}
      const sg=segs[i++];
      const u=new SpeechSynthesisUtterance(sg.t);
      u.lang=sg.l; u.rate=parseFloat(currentRate); u.pitch=1;
      if(sg.v) u.voice=sg.v;
      u.onend=()=>setTimeout(next,350);
      u.onerror=()=>setTimeout(next,100);
      window.speechSynthesis.speak(u);
    }
    next();
  },80);
}

function hlCard(si,ii){
  document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
  const el=document.getElementById(`card-${si}-${ii}`);
  if(el){el.classList.add('playing');el.scrollIntoView({behavior:'smooth',block:'center'});}
}

function speakOne(si,ii){
  shouldStop=false; speakSession++;
  const s=speakSession; hlCard(si,ii);
  const item=currentSceneData.items[ii];
  speak([{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice}],null,s);
}

function speakAll(){
  shouldStop=false; speakSession++;
  const session=speakSession;
  const sec=currentSceneData;
  if(!sec) return;
  let items=sec.items.map((item,ii)=>({item,ii}));
  if(currentSubcat) items=items.filter(({item})=>item.subcategory===currentSubcat);
  if(filterUnlearned) items=items.filter(({item,ii})=>item.role==='staff'||!checkedItems[`${currentSosSection}-${ii}`]);
  // 朗读时跳过staff句（对方说的话不朗读给对方听）
  items=items.filter(({item})=>item.role!=='staff');
  if(!items.length){showToast('没有未学的句子了 🎉',2000);return;}
  speakList(items,0,session);
}

function speakList(list,idx,session){
  if(shouldStop||speakSession!==session) return;
  if(idx>=list.length){
    document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
    if(loopMode){
      showToast('🔁 循环播放中…',1500);
      setTimeout(()=>{
        if(!shouldStop&&speakSession===session) speakList(list,0,session);
      },800);
    } else { showToast('✓ 朗读完毕',2200); }
    return;
  }
  const {item,ii}=list[idx];
  hlCard(currentSosSection,ii);
  speak(getModeTexts(item),()=>setTimeout(()=>speakList(list,idx+1,session),450),session);
}

function pauseOrResume(){
  const synth=window.speechSynthesis;
  const btn=document.getElementById('btnPause');
  if(synth.speaking&&!synth.paused){
    synth.pause();
    if(btn){btn.textContent='▶';btn.classList.add('on');}
  } else if(synth.paused){
    synth.resume();
    if(btn){btn.textContent='⏸';btn.classList.remove('on');}
  }
}

function stopSpeech(){
  shouldStop=true; speakSession++;
  window.speechSynthesis.cancel();
  document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
  const bp=document.getElementById('btnPause');
  if(bp){bp.textContent='⏸';bp.classList.remove('on');}
  if(loopMode){
    loopMode=false;
    const bl=document.getElementById('btnLoop');
    if(bl) bl.classList.remove('on');
  }
}

function toggleLoop(){
  loopMode=!loopMode;
  const btn=document.getElementById('btnLoop');
  if(btn) btn.classList.toggle('on',loopMode);
  showToast(loopMode?'循环播放已开启':'循环播放已关闭',1500);
}

/* ── 模块注册 ── */
window.LJ_MODULES=window.LJ_MODULES||{};
window.LJ_MODULES['sos']={
  init:async function(cfg,icons){
    document.getElementById('panel-sos').innerHTML=`
      <div id="sosHome">
        <div id="banner"></div>
        <div class="sos-scene-wrap">
          <div class="sos-scene-grid" id="sosSceneGrid"></div>
        </div>
      </div>
      <div id="sosDetail">
        <div class="sos-subcat-bar" id="sosSubcatBar" style="display:none"></div>
        <div class="sos-content-wrap">
          <div id="loading" style="display:none"></div>
          <div id="sosContentWrap"></div>
        </div>
      </div>`;

    document.getElementById('ctrlBar').innerHTML=`
      <div class="ctrl-row1">
        <div class="ctrl-row1-left">
          <button class="ctrl-back" id="btnSosBack" onclick="showSosHome()">←场景选择</button>
        </div>
        <div class="ctrl-row1-mid">
          <button class="ctrl-play" onclick="speakAll()">▶ 朗读</button>
          <button class="ctrl-icon" id="btnPause" onclick="pauseOrResume()">⏸</button>
          <button class="ctrl-icon rd" id="btnStop" onclick="stopSpeech()">■</button>
          <button class="ctrl-icon" id="btnLoop" onclick="toggleLoop()">🔁</button>
        </div>
        <div class="ctrl-row1-right">
          <button class="ctrl-unlearned" id="btnUnlearned"
                  onclick="toggleFilterUnlearned()">只看未学</button>
        </div>
      </div>
      <div class="ctrl-row2" id="ctrlRow2"></div>`;

    await sosBoot(cfg,icons);
  }
};