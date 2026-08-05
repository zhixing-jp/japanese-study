const fs = require('fs');
const dir = 'public/data/rescue';
const files = fs.readdirSync(dir).filter(f => 
  f.endsWith('.json') && 
  f !== 'index.json' && 
  !f.includes('scene_icons')
);
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(dir+'/'+f,'utf-8'));
  const items = data.items || [];
  const missing = items.filter(i => !i.en || !i['zh-TW'] || !i.vi || !i.ko);
  if(missing.length) console.log(f+': 缺少多语言字段 '+missing.length+'条');
  else console.log(f+': ✓ '+items.length+'句');
});