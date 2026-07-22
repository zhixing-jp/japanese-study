/* ══════════════════════════════
   base.js — 共用函数
   Living Japanese v3.0
══════════════════════════════ */

/* ── Escape HTML ── */
function esc(s){
  return String(s).replace(/[&<>"']/g, c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

/* ── Toast ── */
let _tt = null;
function showToast(msg, ms=1800){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(_tt);
  _tt = setTimeout(()=>t.classList.remove('on'), ms);
}

/* ── Voice ── */
let jaVoice = null, zhVoice = null;
function initVoices(){
  const v = window.speechSynthesis.getVoices();
  if(!v.length) return;
  for(const n of ['Kyoko','Otoya','O-ren','Hattori']){
    jaVoice = v.find(x=>x.name.includes(n)&&x.lang.startsWith('ja'));
    if(jaVoice) break;
  }
  if(!jaVoice) jaVoice = v.find(x=>x.lang.startsWith('ja'));
  for(const n of ['Ting-Ting','Sin-ji','Mei-Jia','Tian-Tian']){
    zhVoice = v.find(x=>x.name.includes(n));
    if(zhVoice) break;
  }
  if(!zhVoice) zhVoice = v.find(x=>x.lang.startsWith('zh')&&!x.lang.startsWith('ja'));
}
window.speechSynthesis.onvoiceschanged = initVoices;

/* ── Dynamic Module Loader ── */
function loadCSS(href){
  return new Promise((resolve, reject)=>{
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve; link.onerror = reject;
    document.head.appendChild(link);
  });
}
function loadJS(src){
  return new Promise((resolve, reject)=>{
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve; script.onerror = reject;
    document.head.appendChild(script);
  });
}
async function loadModules(modules){
  for(const m of modules){
    try {
      await Promise.all([loadCSS(m.css), loadJS(m.js)]);
    } catch(e){
      console.warn(`模块加载失败: ${m.id}`, e);
    }
  }
}

/* ── Module Registry ── */
window.LJ_MODULES = window.LJ_MODULES || {};

/* ── Tab Switch ── */
let currentTab = 'sos';
function switchTab(name){
  // 急救版块已激活时再次点击，返回场景首页
  if(name === 'sos' && currentTab === 'sos'){
    if(typeof showSosHome === 'function') showSosHome();
    return;
  }
  if(name === 'learn' && currentTab === 'learn'){
  if(typeof closeScene === 'function') closeScene();
  return;
 }
  // 切换Tab时停止所有朗读
  window.speechSynthesis.cancel();
  if(typeof stopSpeech === 'function') stopSpeech();
  if(typeof learnStop === 'function') learnStop();
  currentTab = name;

  // 保存Tab状态
  try{ localStorage.setItem('lj_tab', name); }catch(e){}

  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('panel-'+name).classList.add('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  const tb = document.getElementById('tab-'+name);
  if(tb) tb.classList.add('on');

  const isSos   = name === 'sos';
  const isLearn = name === 'learn';
  const sw  = document.getElementById('searchWrap');
  const lcb = document.getElementById('learnCtrlBar');

  if(sw)  sw.style.display = isSos ? '' : 'none';
  if(lcb) lcb.classList.toggle('on', isLearn);

  // 根据是否有ctrlBar切换main的padding
  const _main = document.querySelector('main');
  if(_main){
    if(name === 'sos' || name === 'learn'){
      _main.classList.add('has-ctrl');
    } else {
      _main.classList.remove('has-ctrl');
    }
  }

  // 更新搜索框placeholder
  if(window.CFG){
    const ph = (CFG.search||{})[name] || '搜索…';
    const si = document.getElementById('searchInput');
    if(si) si.placeholder = ph;
  }

  setTimeout(()=>{
    const hdr = document.getElementById('header');
    if(hdr) document.querySelector('main').style.paddingTop = hdr.offsetHeight+'px';
  }, 50);

  window.scrollTo({top:0, behavior:'smooth'});
  if(window.gtag) gtag('event','tab_switch',{tab:name});
}

/* ── Render Site Title ── */
function renderSiteTitle(cfg){
  const el = document.getElementById('siteTitle');
  if(el) el.textContent = cfg.site?.title || 'Living Japanese';
  document.title = cfg.site?.title || 'Living Japanese';
}

/* ── Render Tab Bar ── */
function renderTabBar(cfg){
  const tabIcons = {shield:'🛡️', book:'📖', heart:'🏥', chat:'💬'};
  document.getElementById('tabBar').innerHTML =
    (cfg.tabs||[]).map(t=>`
      <button class="tab${currentTab===t.id?' on':''}"
              id="tab-${t.id}" onclick="switchTab('${t.id}')">
        <div class="tab-icon">${tabIcons[t.icon]||'●'}</div>
        ${esc(t.label)}
      </button>`).join('');
}

/* ── Render Panels ── */
function renderPanels(cfg){
  const main = document.querySelector('main');
  const tabs = cfg.tabs || [];
  main.innerHTML = tabs.map((t,i)=>`
    <div class="panel${i===0?' on':''}" id="panel-${t.id}"></div>
  `).join('');
}

/* ── Scroll ── */
window.addEventListener('scroll',()=>{
  document.getElementById('backTop').classList.toggle('on', window.scrollY>300);
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) window.speechSynthesis.pause();
});