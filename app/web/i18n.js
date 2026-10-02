// Язык страницы: ?lang=xx, иначе выбранный в переключателе, иначе первый подходящий из navigator.languages, иначе английский.
// Словари — lang/<код>.js, источник правды — lang/ru.js. Проверка ключей: node tools/i18n-check.mjs
export const LANGS = ['ru', 'en', 'es', 'zh', 'ko', 'ja'];
// для переключателя: каждый язык — своим именем; короткая метка — на кнопке в углу
export const NAMES = { en: 'English', ru: 'Русский', es: 'Español', zh: '中文', ko: '한국어', ja: '日本語' };
export const SHORT = { en: 'EN', ru: 'RU', es: 'ES', zh: '中', ko: '한', ja: '日' };
let saved = null;   // выбор в переключателе (core.js кладёт его в localStorage как JSON) сильнее языка браузера, ?lang= — сильнее всего
try { saved = JSON.parse(localStorage.getItem('lang')); } catch {}
const asked = [new URLSearchParams(location.search).get('lang'), saved, ...(navigator.languages || [navigator.language])];
export const lang = asked.map(l => (l || '').toLowerCase().split('-')[0]).find(l => LANGS.includes(l)) || 'en';
document.documentElement.lang = lang;

const load = l => import(`./lang/${l}.js`).then(m => m.default, e => (console.error(e), {}));
// английский снизу: если в словаре нет строки или он не загрузился, видно английский, а не ключ
const dict = lang === 'en' ? await load('en') : { ...await load('en'), ...await load(lang) };
const plural = new Intl.PluralRules(lang);
export const numFmt = new Intl.NumberFormat(lang);

// t('key', { n: 3, p: '17' }): {имя} подставляется; значение-объект { one, few, many, other } — форма по n; массив отдаётся как есть
export function t(key, vars = {}) {
  let s = dict[key] ?? key;
  if (s && typeof s === 'object' && !Array.isArray(s)) s = s[plural.select(vars.n)] ?? s.other;
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? vars[k] : m) : s;
}

// статичный текст в index.html: data-t — содержимое, data-t-title — подсказка
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
for (const el of document.querySelectorAll('[data-t-title]')) el.title = t(el.dataset.tTitle);
