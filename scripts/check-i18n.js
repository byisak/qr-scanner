// scripts/check-i18n.js - 코드에서 쓰는 t('...') 키가 모든 언어 파일에 있는지 검사
// 사용: npm run check:i18n  (누락이 있으면 종료 코드 1)
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');
const LANGS = ['ko', 'en', 'ja', 'zh', 'es'];
const SOURCE_DIRS = ['screens', 'components', 'contexts', 'hooks', 'app', 'utils', 'services'];

const loadLocale = (lang) => {
  const file = path.join(ROOT, 'locales', `${lang}.js`);
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: path.join(ROOT, 'babel.config.js'),
    filename: file,
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports.default || mod.exports;
};

const has = (table, key) => {
  let value = table;
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && k in value) value = value[k];
    else return false;
  }
  return true;
};

const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) files.push(p);
  }
};
SOURCE_DIRS.map(d => path.join(ROOT, d)).filter(fs.existsSync).forEach(walk);

const used = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    if (!used.has(m[1])) used.set(m[1], path.relative(ROOT, file));
  }
}

let failed = false;
for (const lang of LANGS) {
  const table = loadLocale(lang);
  const missing = [...used.keys()].filter(k => !has(table, k)).sort();
  if (missing.length === 0) {
    console.log(`✓ ${lang}: ${used.size} keys`);
  } else {
    failed = true;
    console.log(`✗ ${lang}: ${missing.length} missing`);
    missing.forEach(k => console.log(`    ${k}  (${used.get(k)})`));
  }
}
process.exit(failed ? 1 : 0);
