// Свой headless-браузер на один прогон: node tools/browse.mjs <steps.mjs> [ширина] [высота]
// steps.mjs: export default async (page, shot) => { ...; await shot('name'); return {что угодно} }
// shot('name') сохраняет .scratch/shots/<name>.png. Ошибки страницы печатаются в конце.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
// PW_CORE: path to playwright-core if it isn't resolvable from here; CHROME: browser binary
// (optional, default is Playwright's own downloaded Chromium).
let chromium;
try { ({ chromium } = require(process.env.PW_CORE || 'playwright-core')); }
catch { console.error('browse.mjs: playwright-core not found. Run `npm i -D playwright-core` or set PW_CORE=/path/to/node_modules/playwright-core'); process.exit(1); }
const exe = process.env.CHROME || undefined;
const [stepsFile, w = '1440', h = '900'] = process.argv.slice(2);
const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../.scratch/shots');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async name => { const p = path.join(outDir, name + '.png'); await page.screenshot({ path: p }); return p; };
let result;
try { result = await (await import(pathToFileURL(path.resolve(stepsFile)).href)).default(page, shot); }
finally { await browser.close(); }
console.log(JSON.stringify({ result, errors }, null, 1));
