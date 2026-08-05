/**
 * extract-learn-info.cjs
 * 从index.json提取旧info，统一保存为一个文件供learn版块使用
 * 运行：node scripts/extract-learn-info.cjs
 */

const fs = require('fs');
const path = require('path');

const indexPath = 'public/data/rescue/index.json';
const outputDir = 'public/data/learn/info';
const outputFile = path.join(outputDir, 'learn_info_all.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const scenes = indexData.scenes;

const allInfo = {};
let extracted = 0;

scenes.forEach(scene => {
  if (!scene.info || !scene.info.length) {
    console.log(`- 跳过: ${scene.id}（无info）`);
    return;
  }
  allInfo[scene.id] = {
    id: scene.id,
    title: scene.title,
    title_zh: scene.title_zh,
    info: scene.info
  };
  console.log(`✓ 收集: ${scene.id} - ${scene.title_zh}`);
  extracted++;
});

fs.writeFileSync(outputFile, JSON.stringify(allInfo, null, 2), 'utf-8');
console.log(`\n完成！共提取 ${extracted} 个场景的info。`);
console.log(`保存到: ${outputFile}`);
