/**
 * add-category.cjs
 * 给index.json里的每个场景加入category字段
 * 运行：node scripts/add-category.cjs
 */

const fs = require('fs');

const indexPath = 'public/data/rescue/index.json';
const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

const categoryMap = {
  's00': 'daily',
  's01': 'transport',
  's02': 'transport',
  's03': 'shopping',
  's04': 'shopping',
  's05': 'transport',
  's06': 'medical',
  's07': 'living',
  's08': 'living',
  's09': 'living',
  's10': 'work',
  's11': 'work',
  's12': 'shopping',
  's13': 'living',
  's14': 'living',
  's15': 'emergency',
  's16': 'daily',
  's17': 'living',
  's18': 'living',
  's19': 'leisure',
  's20': 'leisure',
  's21': 'transport',
  's22': 'transport',
  's23': 'work',
  's24': 'emergency'
};

let updated = 0;
data.scenes.forEach(scene => {
  if (categoryMap[scene.id]) {
    scene.category = categoryMap[scene.id];
    console.log(`✓ ${scene.id} → ${categoryMap[scene.id]}`);
    updated++;
  } else {
    console.log(`⚠️ ${scene.id} → 未定义category`);
  }
});

fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n完成！共更新 ${updated} 个场景。`);
