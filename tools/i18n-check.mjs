// Все словари app/web/lang/*.js должны иметь те же ключи, что ru.js, и те же {подстановки}. node tools/i18n-check.mjs
const LANGS = ['ru', 'en', 'es', 'zh', 'ko', 'ja'];
const load = l => import(new URL(`../app/web/lang/${l}.js`, import.meta.url)).then(m => m.default);
const vars = v => JSON.stringify([...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().filter((x, i, a) => x !== a[i - 1]));
const ru = await load('ru');
let bad = 0;
for (const l of LANGS.slice(1)) {
  const d = await load(l);
  for (const k of Object.keys(ru)) {
    if (!(k in d)) { console.log(`${l}: missing key ${k}`); bad++; continue; }
    if (Array.isArray(ru[k]) !== Array.isArray(d[k])) { console.log(`${l}: ${k} — different type`); bad++; }
    else if (vars(ru[k]) !== vars(d[k])) { console.log(`${l}: ${k} — placeholders ${vars(d[k])}, ru has ${vars(ru[k])}`); bad++; }
  }
  for (const k of Object.keys(d)) if (!(k in ru)) { console.log(`${l}: extra key ${k}`); bad++; }
}
console.log(bad ? `problems: ${bad}` : 'ok');
process.exit(bad ? 1 : 0);
