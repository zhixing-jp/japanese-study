/* ══════════════════════════════
   base.js — 共用函数
   Living Japanese v3.0
══════════════════════════════ */

/* ── i18n 国际化核心 ── */
let currentLang = 'zh';
let LOCALE = {};
let CFG = {};

function detectLang(){
  // 1. URL路径优先
  const path = window.location.pathname;
  if(path.startsWith('/en/'))    return 'en';
  if(path.startsWith('/zh-TW/')) return 'zh-TW';
  if(path.startsWith('/vi/'))    return 'vi';
  if(path.startsWith('/ko/'))    return 'ko';
  if(path.startsWith('/zh/'))    return 'zh';

  // 2. localStorage（用户上次手动选择）
  const saved = localStorage.getItem('lj_lang');
  if(saved) return saved;

  // 3. 系统语言自动匹配
  const sys = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if(sys.startsWith('zh-tw') || sys.startsWith('zh-hk')) return 'zh-TW';
  if(sys.startsWith('zh'))  return 'zh';
  if(sys.startsWith('vi'))  return 'vi';
  if(sys.startsWith('ko'))  return 'ko';

  // 4. 兜底：英文
  return 'en';
}

async function loadLocale(lang){
  try{
    LOCALE = await fetch(`/locales/${lang}.json`).then(r=>r.json());
    currentLang = lang;
    document.documentElement.lang = lang;
  }catch(e){
    console.warn(`locale加载失败: ${lang}，使用中文兜底`);
    LOCALE = await fetch('/locales/zh.json').then(r=>r.json());
    currentLang = 'zh';
  }
}

// 翻译函数：界面文字
function t(key, vars={}){
  let str = LOCALE[key] || key;
  Object.keys(vars).forEach(k=>{
    str = str.replace(`{${k}}`, vars[k]);
  });
  return str;
}

// 字段翻译函数：场景数据多语言字段
function tField(obj, field){
  if(!obj) return '';
  return obj[`${field}_${currentLang}`]
    || obj[`${field}_en`]
    || obj[`${field}_zh`]
    || obj[field]
    || '';
}

// 加载 promotions（为将来广告/引导预留，现阶段不在 banner 显示）
async function loadPromotions() {
  try {
    const res = await fetch('promotions.json');
    return res.json();
  } catch(e) {
    return {};
  }
}

async function renderBanner(banner, total) {
  const b = banner || CFG.banner || {};
  const title = b[`title_${currentLang}`] || b.title || '';
  const pills = b[`pills_${currentLang}`] || b.pills || [];
  document.getElementById('banner').innerHTML = `
    <div class="banner-inner">
      <div class="banner-left">
        <div class="banner-eyebrow">${esc(b.eyebrow || '')}</div>
        <div class="banner-title">${esc(title)}</div>
        <div class="banner-pills">
          ${pills.map(p => `<span class="banner-pill">${esc(p)}</span>`).join('')}
        </div>
      </div>
      <div class="banner-right">
        <div class="banner-stat-num">${total}</div>
        <div class="banner-stat-label">${t('banner_stat_label')}</div>
      </div>
    </div>`;
}

function switchLang(lang){
  if(lang === localStorage.getItem('lj_lang')) return;
  localStorage.setItem('lj_lang', lang);
  localStorage.setItem('lj_return_state', JSON.stringify(history.state || {}));
  window.location.reload();
}

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
let currentTab = 'rescue';
function switchTab(name){
  // 急救版块已激活时再次点击，返回场景首页
  if(name === 'rescue' && currentTab === 'rescue'){
    if(typeof showrescueHome === 'function') showrescueHome();
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

  const isrescue   = name === 'rescue';
  const isLearn = name === 'learn';
  const sw  = document.getElementById('searchWrap');
  const lcb = document.getElementById('learnCtrlBar');

  if(sw)  sw.style.display = isrescue ? '' : 'none';
  if(lcb) lcb.classList.toggle('on', isLearn);

  // 根据是否有ctrlBar切换main的padding
  const _main = document.querySelector('main');
  if(_main){
    if(name === 'rescue' || name === 'learn'){
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
/* ── 语言切换菜单 ── */
// 已在index.html里实现toggleLangMenu