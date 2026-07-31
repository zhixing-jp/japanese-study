/* ══════════════════════════════
   rescue.js — 急救版块逻辑 v3
   Living Japanese v3.0
   三层结构：首页→场景→内容
   导航：URL hash 模式
══════════════════════════════ */

/* ── 场景色盘（12色循环）── */
const RESCUE_COLORS = [
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
function getRescueColor(idx){ return RESCUE_COLORS[idx % RESCUE_COLORS.length]; }

/* ── State ── */
let SECTIONS = [], ICONS = {};
let RESCUE_INDEX = null;
let SCENE_META = [];
let RESCUE_CACHE = {};
let currentRescueView = 'home';
let currentRescueSection = -1;
let currentSceneData = null;
let currentSubcat = null;
let checkedItems = {};
let filterUnlearned = false;
let shouldStop = false, loopMode = false, speakSession = 0;
let rubyOn = true, currentMode = 'jp', currentRate = '0.75';

/* ── URL Hash 工具函数 ── */
function setRescueHash(si, subcatId){
  if(si == null){
    history.replaceState(null, '', window.location.pathname);
  } else if(subcatId){
    history.replaceState(null, '', `#rescue/${si}/${subcatId}`);
  } else {
    history.replaceState(null, '', `#rescue/${si}`);
  }
}

function parseRescueHash(hash){
  if(!hash || !hash.startsWith('#rescue/')) return null;
  const parts = hash.slice(8).split('/');
  const si = parseInt(parts[0]);
  if(isNaN(si)) return null;
  return { si, subcatId: parts[1] || null };
}

/* ── Boot ── */
async function rescueBoot(cfg, icons){
  ICONS = icons;
  currentMode = cfg.controls?.defaultMode || 'jp';
  currentRate = cfg.controls?.defaultRate  || '0.75';
  loadRescueStorage();

  try{
    const index = await fetch('data/rescue/index.json').then(r=>r.json());
    RESCUE_INDEX = index;
    SCENE_META = index.scenes;

    await Promise.all(SCENE_META.map(async (sc, si) => {
      try {
        const data = await fetch(sc.file).then(r=>r.json());
        RESCUE_CACHE[si] = data;
        sc.count = data.items.length;
      } catch(e) { console.warn('场景加载失败:', sc.file); }
    }));

    const total = SCENE_META.reduce((s, sc) => s + (sc.count || 0), 0);
    await renderBanner(CFG.banner, total);
    renderRescueHome();
    renderCtrlBar(cfg.controls);
    showRescueHome(true);

    // 从 URL hash 恢复位置
    const parsed = parseRescueHash(window.location.hash);
    if(parsed){
      const { si, subcatId } = parsed;
      if(subcatId){
        await openRescueScene(si);
        currentSubcat = subcatId;
        renderSubcatBar(si);
        renderRescueContent(si, subcatId);
        updateCtrlBarMode('content');
        const ctrlBar = document.getElementById('ctrlBar');
        if(ctrlBar) ctrlBar.classList.add('on');
        document.querySelector('main')?.classList.add('has-ctrl');
      } else {
        openRescueScene(si);
      }
    }

    // 监听浏览器返回/前进
    window.addEventListener('hashchange', ()=>{
      const parsed = parseRescueHash(window.location.hash);
      stopSpeech();
      if(!parsed){
        showRescueHome(true);
      } else {
        const { si, subcatId } = parsed;
        if(subcatId){
          currentSubcat = subcatId;
          currentRescueSection = si;
          currentSceneData = RESCUE_CACHE[si];
          document.getElementById('ctrlBar').classList.add('on');
          updateCtrlBarMode('content');
          renderSubcatBar(si);
          renderRescueContent(si, subcatId);
        } else {
          currentSubcat = null;
          filterUnlearned = false;
          currentRescueSection = si;
          currentSceneData = RESCUE_CACHE[si];
          showRescueDetail(si);
        }
      }
    });

    document.getElementById('loading').style.display='none';

    setTimeout(()=>{
      const hdr=document.getElementById('header');
      if(hdr) document.querySelector('main').style.paddingTop=hdr.offsetHeight+'px';
    },100);

  }catch(e){
    document.getElementById('loading').textContent='加载失败，请检查 data/rescue/index.json';
    console.error(e);
  }
}

/* ── Storage ── */
function loadRescueStorage(){
  try{ checkedItems=JSON.parse(localStorage.getItem('lj_checked')||'{}'); }catch(e){ checkedItems={}; }
}
function saveRescueStorage(){
  try{ localStorage.setItem('lj_checked',JSON.stringify(checkedItems)); }catch(e){}
}

/* ── 场景首页 ── */
function renderRescueHome(){
  const wrap=document.getElementById('rescueSceneGrid');
  if(!wrap||!SCENE_META) return;
  wrap.innerHTML=SCENE_META.map((sc,si)=>{
    const icon=ICONS[sc.title]||'📖';
    const hasBg=!!sc.image;
    const [c1,c2]=getRescueColor(si);
    const bgStyle=hasBg
      ?`background-image:url('${sc.image}')`
      :`background:linear-gradient(135deg,${c1} 0%,${c2} 100%)`;
    return`<div class="rescue-scene-card" onclick="openRescueScene(${si})">
      <div class="rescue-scene-bg" style="${bgStyle}"></div>
      <div class="rescue-scene-overlay"${hasBg?'':' style="display:none"'}></div>
      <div class="rescue-scene-content">
        <div class="rescue-scene-emoji">${icon}</div>
        <div class="rescue-scene-title">${esc(tField(sc,'title')||sc.title)}</div>
        <div class="rescue-scene-count">${sc.count}句</div>
      </div>
    </div>`;
  }).join('');
}

/* ── 打开场景 ── */
async function openRescueScene(si){
  currentRescueSection=si;
  currentSubcat=null;
  filterUnlearned=false;
  stopSpeech();

  if(!RESCUE_CACHE[si]){
    const meta=SCENE_META[si];
    try{
      const data=await fetch(meta.file).then(r=>r.json());
      RESCUE_CACHE[si]=data;
    }catch(e){
      showToast('场景加载失败',2000); return;
    }
  }
  currentSceneData=RESCUE_CACHE[si];
  setRescueHash(si);
  showRescueDetail(si);
}

/* ── 视图切换 ── */
function showRescueHome(fromHashChange){
  if(!fromHashChange) setRescueHash(null);
  currentRescueView='home';
  const home=document.getElementById('rescueHome');
  home.style.display='';
  home.style.animation='none';
  requestAnimationFrame(()=>{ home.style.animation='fadeIn .2s ease-out'; });
  document.getElementById('rescueDetail').classList.remove('on');
  document.getElementById('ctrlBar').classList.remove('on');
  document.querySelector('main').classList.remove('has-ctrl');
  const sw=document.getElementById('searchWrap');
  if(sw) sw.style.display='none';
  updateCtrlBarMode('home');
  window.scrollTo({top:0,behavior:'smooth'});
}

function showRescueDetail(si){
  currentRescueView='content';
  document.getElementById('rescueHome').style.display='none';
  document.getElementById('rescueDetail').classList.add('on');
  document.querySelector('main').classList.add('has-ctrl');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{
    const hdr=document.getElementById('header');
    if(hdr) document.querySelector('main').style.paddingTop=hdr.offsetHeight+'px';
  },50);

  const meta=SCENE_META[si]||{};
  const subcats=meta.subcategories||[];

  if(subcats.length && !currentSubcat){
    document.getElementById('ctrlBar').classList.remove('on');
    updateCtrlBarMode('home');
    renderSceneLanding(si);
  } else {
    document.getElementById('ctrlBar').classList.add('on');
    updateCtrlBarMode('content');
    renderSubcatBar(si);
    renderRescueContent(si, currentSubcat);
  }
}

/* ── 场景Landing页 ── */
function renderSceneLanding(si){
  if(!window.currentLang) window.currentLang = detectLang();
  const meta=SCENE_META[si]||{};
  const subcats=meta.subcategories||[];
  const wrap=document.getElementById('rescueContentWrap');
  const bar=document.getElementById('rescueSubcatBar');
  if(bar) bar.style.display='none';
  if(!wrap) return;

  const [lc1,lc2]=getRescueColor(si);
  wrap.innerHTML=`
    <div class="rescue-scene-landing">
      <div class="rescue-landing-hero" style="background:linear-gradient(135deg,${lc1} 0%,${lc2} 100%)">
        <button class="rescue-landing-back" onclick="showRescueHome()">${t("back")}</button>
        <div class="rescue-landing-title-hero">${esc(tField(meta,'title')||meta.title)}</div>
        <div class="rescue-landing-desc-hero">${esc(tField(meta,'description')||meta.description||'')}</div>
      </div>
      <div class="rescue-landing-desc" style="display:none">${esc(meta.description||'')}</div>
      ${(meta.info&&meta.info.length)?`
      <div class="scene-info-wrap" onclick="
        const info=this.querySelector('.scene-info');
        const btn=this.querySelector('.scene-info-toggle');
        info.classList.toggle('expanded');
        btn.textContent=info.classList.contains('expanded')?t('click_close'):t('click_open');
      ">
        <div class="scene-info" id="scene-info-${si}">
          ${meta.info.map(sec=>`
            <div class="scene-info-section">
              <div class="scene-info-title">${tField(sec,'title')||sec.title}</div>
              <div class="scene-info-body">
                ${sec.table ? `
                  <table class="scene-info-table">
                    ${sec.table.map((row,i)=>`
                      <tr class="${i===0?'scene-info-table-header':''}">
                        ${row.map(cell=>`<td>${cell}</td>`).join('')}
                      </tr>`).join('')}
                  </table>
                ` : (sec[`lines_${currentLang}`]||sec.lines_en||sec.lines||[]).map(l=>l).join('<br>')}
              </div>
            </div>`).join('')}
        </div>
        <div class="scene-info-toggle">${t('click_open')}</div>
      </div>
      `:''}
      <div class="rescue-landing-grid">
        ${subcats.map(s=>`
          <button class="rescue-landing-btn" onclick="selectSubcat('${s.id}',${si})">
            <span class="rescue-landing-btn-title">${esc(tField(s,'title')||s.title)}</span>
            <span class="rescue-landing-btn-ja">${esc(tField(s,'title_ja')||s.title_ja||'')}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

function selectSubcat(subcatId, si){
  currentSubcat=subcatId;
  setRescueHash(si, subcatId);
  document.getElementById('ctrlBar').classList.add('on');
  updateCtrlBarMode('content');
  renderSubcatBar(si);
  renderRescueContent(si, subcatId);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── 二级分类Bar ── */
function renderSubcatBar(si){
  const meta=SCENE_META[si]||{};
  const bar=document.getElementById('rescueSubcatBar');
  if(!bar) return;
  const subcats=meta.subcategories||[];
  if(!subcats.length){
    bar.style.display='none'; return;
  }
  bar.style.display='';
  bar.innerHTML=[
    `<button class="rescue-subcat-btn${!currentSubcat?' on':''}"
             onclick="setSubcat(null)">${t('back')}</button>`
  ].concat(subcats.map(s=>
    `<button class="rescue-subcat-btn${currentSubcat===s.id?' on':''}"
             id="subcat-${s.id}" onclick="setSubcat('${s.id}')">
      ${esc(tField(s,'title')||s.title)}
    </button>`
  )).join('');
}

function setSubcat(id){
  if(!id){
    currentSubcat=null;
    setRescueHash(currentRescueSection);
    document.getElementById('ctrlBar').classList.remove('on');
    updateCtrlBarMode('home');
    renderSceneLanding(currentRescueSection);
    window.scrollTo({top:0,behavior:'smooth'});
    return;
  }
  currentSubcat=id;
  setRescueHash(currentRescueSection, id);
  document.getElementById('ctrlBar').classList.add('on');
  updateCtrlBarMode('content');
  renderSubcatBar(currentRescueSection);
  renderRescueContent(currentRescueSection, id);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── 内容渲染 ── */
function renderRescueContent(si, subcatId){
  const sec=currentSceneData;
  const wrap=document.getElementById('rescueContentWrap');
  if(!wrap||!sec) return;

  let items=sec.items.map((item,ii)=>({item,ii}));
  if(subcatId){
    items=items.filter(({item})=>item.subcategory===subcatId);
  }
  if(filterUnlearned){
    items=items.filter(({item,ii})=>item.role==='staff'||!checkedItems[`${si}-${ii}`]);
  }

  if(!items.length){
    wrap.innerHTML='<p style="color:var(--t4);padding:20px 0;font-size:13px;text-align:center">${t("all_done")}</p>';
    return;
  }

  wrap.innerHTML=items.map(({item,ii})=>{
    const isStaff=item.role==='staff';
    const isDone=!!checkedItems[`${si}-${ii}`];
    return`<div class="card${isDone?' done':''}${isStaff?' is-staff':''}" id="card-${si}-${ii}">
      ${isStaff?`<span class="staff-label">${t('staff_label')}</span>`:''}
      <div class="card-top">
        <div class="card-num">${ii+1}</div>
        <div class="card-btns-top">
          <button class="card-play-btn${isStaff?' is-staff-btn':''}" onclick="speakOne(${si},${ii})">${isStaff?t('staff_listen'):t('speak_one')}</button>
          ${!isStaff?`<button class="lbtn${isDone?' on':''}" id="lb-${si}-${ii}"
                  onclick="toggleDone(${si},${ii})">${isDone?t('learned_done'):t('learned')}</button>`:''}
        </div>
      </div>
      <div class="jp">${rubyHtml(item.jp,item.furigana)}</div>
      <div class="zh">${esc(item[currentLang]||item.zh)}</div>
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
  if(currentRescueView==='content') renderRescueContent(currentRescueSection,currentSubcat);
}

/* ── 学会了 ── */
function toggleDone(si,ii){
  const key=`${si}-${ii}`;
  checkedItems[key]=!checkedItems[key];
  if(!checkedItems[key]) delete checkedItems[key];
  saveRescueStorage();
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
    if(lb){lb.classList.toggle('on',isDone);lb.textContent=isDone?t('learned_done'):t('learned');}
  }
}

/* ── 只看未学 ── */
function toggleFilterUnlearned(){
  filterUnlearned=!filterUnlearned;
  const btn=document.getElementById('btnUnlearned');
  if(btn) btn.classList.toggle('on',filterUnlearned);
  renderRescueContent(currentRescueSection,currentSubcat);
}

/* ── 搜索 ── */
function doRescueSearch(q){
  stopSpeech();
  document.getElementById('rescueHome').style.display='none';
  document.getElementById('rescueDetail').classList.add('on');
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
            <button class="card-play-btn" onclick="speakOne(${si},${ii})">${t('speak_one')}</button>
          </div>
        </div>
        <div class="jp">${hlTxt(item.jp,q)}</div>
        <div class="zh">${hlTxt(item.zh,q)}</div>
      </div>`;
    });
  });
  const wrap=document.getElementById('rescueContentWrap');
  if(wrap) wrap.innerHTML=`
    <div class="srch-header">「${esc(q)}」的搜索结果：${total}句</div>
    ${html || `<p style="color:var(--t4);padding:20px 0;font-size:13px">${t('no_results')}</p>`}
  `;
  const bar=document.getElementById('rescueSubcatBar');
  if(bar) bar.style.display='none';
}

function hlTxt(t,q){
  const e=esc(t), eq=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return e.replace(new RegExp(eq,'gi'),m=>`<mark>${m}</mark>`);
}

function clearRescueSearch(){
  const si=document.getElementById('searchInput');
  if(si) si.value='';
  if(currentRescueView==='content'){
    renderSubcatBar(currentRescueSection);
    renderRescueContent(currentRescueSection,currentSubcat);
    updateCtrlBarMode('content');
  } else {
    showRescueHome();
  }
}

/* ── Controls Bar ── */
function renderCtrlBar(c){
  c=c||{};
  const modeHtml=`<div class="cseg">
    ${(c.modes||[]).map(m=>
      `<button class="btn${currentMode===m.id?' on':''}" id="smode-${m.id}"
               onclick="setRescueMode('${m.id}')">${t('mode_'+m.id)}</button>`
    ).join('')}
  </div>`;
  const rateHtml=`<div class="cseg">
    ${(c.rates||[]).map(r=>
      `<button class="btn${currentRate===r.id?' on':''}" id="srate-${r.id}"
               onclick="setRescueRate('${r.id}')">${t('rate_'+r.id)}</button>`
    ).join('')}
  </div>`;
  const row2=document.getElementById('ctrlRow2');
  if(row2) row2.innerHTML=modeHtml+rateHtml+`
    <button class="ctrl-icon sm" id="btnRuby" onclick="toggleRuby()">${t('learn_ruby')}</button>`;
}

function updateCtrlBarMode(mode){
  const cb=document.getElementById('ctrlBar');
  if(!cb) return;
  if(mode==='home'){
    cb.classList.remove('on'); return;
  }
  cb.classList.add('on');
  const backBtn=document.getElementById('btnRescueBack');
  if(backBtn) backBtn.style.display= mode==='search'?'none':'';
}

function setRescueMode(m){
  currentMode=m;
  document.querySelectorAll('[id^="smode-"]').forEach(el=>el.classList.remove('on'));
  const el=document.getElementById('smode-'+m);
  if(el) el.classList.add('on');
}
function setRescueRate(r){
  currentRate=r;
  document.querySelectorAll('[id^="srate-"]').forEach(el=>el.classList.remove('on'));
  const el=document.getElementById('srate-'+r);
  if(el) el.classList.add('on');
}

/* ── 朗读 ── */
function getModeTexts(item){
  const langMap = {'zh':'zh-CN','zh-TW':'zh-TW','en':'en-US','vi':'vi-VN','ko':'ko-KR'};
  const ttsLang = langMap[currentLang] || 'zh-CN';
  const ttsText = tField(item,'zh') || item.zh;
  if(currentMode==='jp')    return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice}];
  if(currentMode==='jp_zh') return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice},{t:ttsText,l:ttsLang,v:zhVoice}];
  return [{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice},{t:ttsText,l:ttsLang,v:zhVoice},{t:item.furigana||item.jp,l:'ja-JP',v:jaVoice}];
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
  if(filterUnlearned) items=items.filter(({item,ii})=>item.role==='staff'||!checkedItems[`${currentRescueSection}-${ii}`]);
  items=items.filter(({item})=>item.role!=='staff');
  if(!items.length){showToast(t('all_done'),2000);return;}
  speakList(items,0,session);
}

function speakList(list,idx,session){
  if(shouldStop||speakSession!==session) return;
  if(idx>=list.length){
    document.querySelectorAll('.card.playing').forEach(el=>el.classList.remove('playing'));
    if(loopMode){
      showToast('🔁 '+t('learn_loop')+'…',1500);
      setTimeout(()=>{
        if(!shouldStop&&speakSession===session) speakList(list,0,session);
      },800);
    } else { showToast('✓ '+t('speak_all').replace('▶ ','')+'…',2200); }
    return;
  }
  const {item,ii}=list[idx];
  hlCard(currentRescueSection,ii);
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
  showToast(loopMode?t('learn_loop')+' ON':t('learn_loop')+' OFF',1500);
}

/* ── 模块注册 ── */
window.LJ_MODULES=window.LJ_MODULES||{};
window.LJ_MODULES['rescue']={
  init:async function(cfg,icons){
    document.getElementById('panel-rescue').innerHTML=`
      <div id="rescueHome">
        <div id="banner"></div>
        <div class="rescue-scene-wrap">
          <div class="rescue-scene-grid" id="rescueSceneGrid"></div>
        </div>
      </div>
      <div id="rescueDetail">
        <div class="rescue-subcat-bar" id="rescueSubcatBar" style="display:none"></div>
        <div class="rescue-content-wrap">
          <div id="loading" style="display:none"></div>
          <div id="rescueContentWrap"></div>
        </div>
      </div>`;

    document.getElementById('ctrlBar').innerHTML=`
      <div class="ctrl-row1">
        <div class="ctrl-row1-left">
          <button class="ctrl-back" id="btnRescueBack" onclick="showRescueHome()">${t('back')}</button>
        </div>
        <div class="ctrl-row1-mid">
          <button class="ctrl-play" onclick="speakAll()">${t('speak_all')}</button>
          <button class="ctrl-icon" id="btnPause" onclick="pauseOrResume()">⏸</button>
          <button class="ctrl-icon rd" id="btnStop" onclick="stopSpeech()">■</button>
          <button class="ctrl-icon" id="btnLoop" onclick="toggleLoop()">🔁</button>
        </div>
        <div class="ctrl-row1-right">
          <button class="ctrl-unlearned" id="btnUnlearned"
                  onclick="toggleFilterUnlearned()">${t('unlearned_only')}</button>
        </div>
      </div>
      <div class="ctrl-row2" id="ctrlRow2"></div>`;

    await rescueBoot(cfg,icons);
  }
};