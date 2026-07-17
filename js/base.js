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

/* ── Tab Switch ── */
let currentTab = 'sos';
function switchTab(name){
  currentTab = name;
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('panel-'+name).classList.add('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  const tb = document.getElementById('tab-'+name);
  if(tb) tb.classList.add('on');

  const isSos = name === 'sos';
  const sbw = document.getElementById('sceneBarWrap');
  const sw  = document.getElementById('searchWrap');
  const cb  = document.getElementById('ctrlBar');
  if(sbw) sbw.style.display = isSos ? '' : 'none';
  if(sw)  sw.style.display  = isSos ? '' : 'none';
  if(cb)  cb.style.display  = isSos ? '' : 'none';

  document.querySelector('main').style.paddingBottom =
    isSos ? `calc(var(--ctrl-h) + var(--tab-h))` : `var(--tab-h)`;

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

/* ── Render Tab Bar ── */
function renderSiteTitle(cfg){
  const el = document.getElementById('siteTitle');
  if(el) el.textContent = cfg.site?.title || 'Living Japanese';
  document.title = (cfg.site?.title || 'Living Japanese') + ' | ' + (cfg.site?.subtitle || '');
}
function renderTabBar(cfg){
  const tabIcons = {shield:'🛡️', book:'📖', heart:'🏥', chat:'💬'};
  document.getElementById('tabBar').innerHTML =
    (cfg.tabs||[]).map(t=>`
      <button class="tab${currentTab===t.id?' on':''}" id="tab-${t.id}"
              onclick="switchTab('${t.id}')">
        <div class="tab-icon">${tabIcons[t.icon]||'●'}</div>
        ${esc(t.label)}
      </button>`).join('');
}

/* ── Scroll ── */
window.addEventListener('scroll',()=>{
  document.getElementById('backTop').classList.toggle('on', window.scrollY>300);
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) window.speechSynthesis.pause();
});
