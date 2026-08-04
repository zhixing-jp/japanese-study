/**
 * add-furigana.cjs
 * 用MeCab自动为rescue JSON文件生成精确振假名
 * 运行：npm run furigana
 */

const MeCab = require('mecab-async');
const fs = require('fs/promises');
const path = require('path');

const mecab = new MeCab();

// 片假名转平假名
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// 判断字符串是否含汉字
function hasKanji(str) {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(str);
}

// MeCab解析
function parse(text) {
  return new Promise((resolve, reject) => {
    mecab.parse(text, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// 生成第二种格式furigana
// token结构: [surface, pos, pos2, pos3, pos4, conj1, conj2, base, reading, pronunciation]
function buildFurigana(parsed) {
  let result = '';
  for (const token of parsed) {
    if (!token || !token[0] || token[0] === 'EOS') continue;
    const surface = token[0];
    const reading = token[8];
    if (!reading) {
      result += surface;
    } else {
      result += katakanaToHiragana(reading);
    }
  }
  return result;
}

async function processFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if (!data.items || !Array.isArray(data.items)) return;

  let changed = false;
  for (const item of data.items) {
    if (!item.jp) continue;
    const parsed = await parse(item.jp);
    const newFurigana = buildFurigana(parsed);
    if (newFurigana && newFurigana !== item.furigana) {
      item.furigana = newFurigana;
      changed = true;
    }
  }

  if (changed) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✓ 更新: ${path.basename(filePath)}`);
  } else {
    console.log(`- 跳过: ${path.basename(filePath)}`);
  }
}

async function main() {
  const rescueDir = 'public/data/rescue';
  const files = await fs.readdir(rescueDir);
  const jsonFiles = files.filter(f =>
    f.endsWith('.json') &&
    f !== 'index.json' &&
    !f.includes('scene_icons')
  );

  console.log(`找到 ${jsonFiles.length} 个场景文件，开始处理...`);

  for (const file of jsonFiles) {
    try {
      await processFile(path.join(rescueDir, file));
    } catch(e) {
      console.error(`错误: ${file}`, e.message);
    }
  }

  console.log('\n完成！');
  process.exit(0);
}

main();
