// Ядро: баланс, ставки, звук, эффекты, плашка результата, вкладки игр, связь с сервером.
// Контракт игры — docs/games-contract.md. Игры только рисуют свой стол и зовут api.*.
import slots from './games/slots.js';
import roulette from './games/roulette.js';
import blackjack from './games/blackjack.js';
import { openShare } from './share.js';
import { t, numFmt, lang, LANGS, NAMES, SHORT } from './i18n.js';

const GAMES = [slots, roulette, blackjack];
export const MIN_BET = 1000;
export const FRACS = [0.1, 0.25, 0.5, 1];

// ---------- деньги ----------
export const TK = '<svg class="tk" viewBox="0 0 20 24" aria-hidden="true"><path d="M2 2h16v4h-6v16H8V6H2z M3 11h14v3H3z"/></svg>';
export function fmt(n) {
  n = Math.floor(Math.abs(n));
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return numFmt.format(n);
}
export const money = (n, sign = '') => sign + TK + fmt(n);
export const pick = xs => xs[Math.floor(Math.random() * xs.length)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---------- состояние ----------
export const S = {
  sources: [], earned: 0, net: 0, today: null, records: null, config: {}, date: null,
  loaded: false, busy: false, pending: 0, gen: 0, frac: store.get('frac', 0.1), shown: 0,
};
export const balance = () => Math.max(0, Math.floor(S.earned + S.net));
export const betFor = (f, bal = balance()) => bal < MIN_BET ? 0 : f >= 1 ? bal : Math.min(bal, Math.max(MIN_BET, Math.floor(bal * f)));

// ---------- звук: синтез, без файлов ----------
let ac = null, muted = store.get('muted', false);
function audio() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
export function tone(freq, dur, type = 'square', vol = .08, slide = 0, when = 0) {
  if (muted) return;
  const a = audio(), t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
export const sfx = {
  tick: () => tone(900 + Math.random() * 500, .03, 'square', .025),
  thud: (i = 0) => { tone(140 - i * 15, .18, 'sine', .3, -60); tone(2400, .02, 'square', .03); },
  click: () => tone(660, .06, 'triangle', .12),
  card: () => { tone(1800, .03, 'triangle', .05, -900); tone(300, .05, 'sine', .08, -120, .01); },
  chip: () => { tone(2200, .03, 'square', .04); tone(1400, .05, 'triangle', .05, 0, .02); },
  coin: () => { tone(1320, .06, 'square', .05); tone(1760, .12, 'square', .05, 0, .05); },
  count: p => tone(500 + p * 900, .025, 'square', .03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .16, 'square', .08, 0, i * .08)),
  big: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, .22, 'square', .08, 0, i * .07); tone(f / 2, .22, 'triangle', .1, 0, i * .07); }),
  push: () => { tone(440, .12, 'triangle', .1); tone(440, .12, 'triangle', .08, 0, .14); },
  lose: () => { tone(300, .5, 'sawtooth', .07, -180); tone(150, .6, 'sine', .15, -60, .1); },
  glitch: () => { for (let i = 0; i < 14; i++) tone(80 + Math.random() * 2000, .05, 'sawtooth', .06, 0, i * .05); },
};

// ---------- эффекты ----------
const stage = $('stage');
export function shake(px, ms) {
  const k = Array.from({ length: 8 }, (_, j) => {
    const f = 1 - j / 8;
    return { transform: `translate(${(Math.random() - .5) * 2 * px * f}px, ${(Math.random() - .5) * 2 * px * f}px) rotate(${(Math.random() - .5) * px * .25 * f}deg)` };
  });
  stage.animate([...k, { transform: 'none' }], { duration: ms, easing: 'linear' });
}
export function pop(el, s = 1.35) { el.animate([{ transform: 'scale(1)' }, { transform: `scale(${s}) rotate(${(Math.random() - .5) * 8}deg)` }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' }); }

const fxc = $('fx'), g = fxc.getContext('2d');
let parts = [];
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export function burst(x, y, count, kind = 'coin') {
  const confetti = [cssVar('--c1'), cssVar('--c2'), cssVar('--c3'), cssVar('--c4'), cssVar('--c5')].filter(Boolean);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * (kind === 'confetti' ? 14 : 10);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, life: 1, kind, r: 5 + Math.random() * 7,
      rot: Math.random() * 6, vr: (Math.random() - .5) * .4, col: kind === 'confetti' ? pick(confetti) : null });
  }
}
export function rain(count) {
  for (let i = 0; i < count; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .8,
    vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 4, life: 1.6, kind: 'coin', r: 6 + Math.random() * 6, rot: 0, vr: .2 });
}
export function burstAt(el, count, kind) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, count, kind); }
function drawParts() {
  g.clearRect(0, 0, fxc.width, fxc.height);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  const coin = cssVar('--coin') || '#ffcc00', coinEdge = cssVar('--coin-edge') || '#8a4b00';
  for (const p of parts) {
    p.vy += .45; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= .006;
    g.save(); g.translate(p.x * devicePixelRatio, p.y * devicePixelRatio); g.rotate(p.rot);
    g.globalAlpha = Math.min(1, p.life * 2); const r = p.r * devicePixelRatio;
    if (p.kind === 'coin') {
      g.scale(Math.abs(Math.cos(p.rot * 2)) + .15, 1);
      g.fillStyle = coinEdge; g.beginPath(); g.arc(0, r * .15, r, 0, 7); g.fill();
      g.fillStyle = coin; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
      g.fillStyle = coinEdge; g.fillRect(-r * .45, -r * .55, r * .9, r * .22); g.fillRect(-r * .12, -r * .55, r * .24, r * 1.1);
    } else { g.fillStyle = p.col; g.fillRect(-r / 2, -r / 4, r, r / 2); }
    g.restore();
  }
}
const banner = $('banner');
export async function showBanner(text, color, ms = 1300) {
  banner.textContent = text; banner.style.color = color || '';
  await banner.animate([
    { opacity: 0, transform: 'scale(.2) rotate(-12deg)' },
    { opacity: 1, transform: 'scale(1.15) rotate(4deg)', offset: .2 },
    { opacity: 1, transform: 'scale(1) rotate(-2deg)', offset: .35 },
    { opacity: 1, transform: 'scale(1.04) rotate(1deg)', offset: .8 },
    { opacity: 0, transform: 'scale(1.6) rotate(0deg)' },
  ], { duration: ms, easing: 'ease-out' }).finished;
}
export let hype = 0;   // 0..1, тема может разгонять по нему фон
export function glitch(ms = 1100) { document.body.classList.add('glitch'); sfx.glitch(); return sleep(ms).then(() => document.body.classList.remove('glitch')); }

// фон темы: модуль themes/<id>.js может экспортировать draw(ctx, w, h, t, hype)
const bg = $('bg'), bgc = bg.getContext('2d');
let bgDraw = null;
function frame(now) {
  hype *= .985;
  if (bgDraw) { try { bgDraw(bgc, bg.width, bg.height, now / 1000, hype); } catch (e) { bgDraw = null; console.error(e); } }
  drawParts(); requestAnimationFrame(frame);
}
function resize() {
  fxc.width = innerWidth * devicePixelRatio; fxc.height = innerHeight * devicePixelRatio;
  const k = bgDraw?.scale ?? 1; bg.width = Math.max(1, Math.round(innerWidth * k)); bg.height = Math.max(1, Math.round(innerHeight * k));
}
addEventListener('resize', resize);

// ---------- темы ----------
export const THEMES = [{ id: 'pixel', name: 'Pixel', bg: true }];
async function applyTheme(id) {
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  $('themeCss').href = `themes/${t.id}.css`;
  document.documentElement.dataset.theme = t.id;
  bgDraw = null; bgc.clearRect(0, 0, bg.width, bg.height);
  if (t.bg) { try { const m = await import(`./themes/${t.id}.js`); bgDraw = m.draw; bgDraw.scale = m.scale ?? 1; } catch (e) { console.error(e); } }
  resize();
  store.set('theme', t.id);
  document.querySelectorAll('#themes button').forEach(b => b.classList.toggle('on', b.dataset.id === t.id));
}

// ---------- UI: кошелёк, источники, ставки, результат ----------
const balEl = $('bal'), subEl = $('sub'), quoteEl = $('quote'), primaryBtn = $('primary');
const resEl = $('result'), rk = $('rk'), rv = $('rv'), rf = $('rf');

function renderTitle() {
  document.title = S.config.title_balance && S.loaded ? `₮${fmt(balance())} · GAMBLE YOUR TOKENS` : 'GAMBLE YOUR TOKENS';
}
function renderWallet() {
  if (!S.loaded) { balEl.textContent = '…'; subEl.textContent = ''; return; }
  balEl.innerHTML = money(S.shown);
  balEl.classList.toggle('empty', S.shown < MIN_BET);
  renderSub(); renderTitle(); refit();
}
function renderSub() {
  const n = Math.floor(S.net), cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
  subEl.innerHTML = `${t('earnedToday')} <b>${money(S.earned)}</b> · ${t('inCasino')} <span class="${cls}">${money(n, n > 0 ? '+' : n < 0 ? '−' : '')}</span>`;
  renderSources(); refit();
}
const hue = name => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
const color = name => `hsl(${hue(name)} 70% 62%)`;
const TOP = 4;
let srcOpen = false;
function renderSources() {
  const list = S.sources, total = S.earned || 1, bar = $('srcBar'), legend = $('srcLegend');
  const live = list.filter(x => x.tokens > 0);
  while (bar.children.length > live.length) bar.lastChild.remove();
  live.forEach((x, i) => {
    const seg = bar.children[i] || bar.appendChild(document.createElement('i'));
    seg.style.background = color(x.name); seg.style.flexGrow = x.tokens / total; seg.title = `${x.name} ${fmt(x.tokens)}`;
  });
  const top = list.length <= TOP + 1 ? list : list.slice(0, TOP), rest = list.slice(top.length);
  fillLegend(legend, top);
  if (rest.length) {
    const more = document.createElement('span'); more.className = 'more';
    more.innerHTML = srcOpen ? t('collapse') : `${t('more', { n: rest.length })} · ${money(rest.reduce((a, x) => a + x.tokens, 0))}`;
    more.onclick = e => { e.stopPropagation(); srcOpen = !srcOpen; renderSources(); };
    legend.append(more);
  }
  $('srcAll').classList.toggle('open', srcOpen && rest.length > 0);
  if (srcOpen) fillLegend($('srcAll'), list);
}
function fillLegend(box, items) {
  box.innerHTML = '';
  for (const x of items) {
    const el = document.createElement('span');
    el.style.setProperty('--c', color(x.name));
    if (!x.tokens) el.className = 'zero';
    el.innerHTML = `${x.name} <b>${money(x.tokens)}</b>${x.error ? ' ⚠' : ''}`;
    if (x.error) el.title = t('readFail', { err: x.error });
    box.append(el);
  }
}
addEventListener('click', e => { if (srcOpen && !e.target.closest('#srcAll')) { srcOpen = false; renderSources(); } });

let primaryLabel = 'SPIN', primaryEnabled = true, primaryInRound = false;
function renderBets() {
  const bal = balance(), broke = bal < MIN_BET;
  document.querySelectorAll('.bet').forEach(b => {
    const f = Number(b.dataset.f);
    b.classList.toggle('on', f === S.frac);
    b.disabled = S.busy;
    b.querySelector('small').innerHTML = !S.loaded ? '…' : broke ? '—' : money(betFor(f, bal));
  });
  primaryBtn.querySelector('span').textContent = primaryLabel;
  const inRound = S.busy && primaryInRound;   // игра разрешила кнопку посреди хода (ХВАТИТ в очке)
  primaryBtn.disabled = !S.loaded || !primaryEnabled || (S.busy ? !inRound : broke);
  $('primaryAmt').innerHTML = inRound ? '' : !S.loaded ? '…' : broke ? t('noTokens') : money(betFor(S.frac, bal));
  if (S.loaded && !S.busy && broke && !resEl.classList.contains('lose')) setResult('broke', t('res.broke'), 'usage limit reached', '');
  document.querySelectorAll('#tabs button').forEach(b => { b.disabled = S.busy; });
  $('langBtn').disabled = S.busy;
  document.querySelectorAll('#langMenu button').forEach(b => { b.disabled = S.busy; });
  if (S.busy) $('langMenu').classList.remove('open');
  refit();
}
export function setResult(cls, k, v, f = '') { resEl.className = 'result ' + cls; rk.textContent = k; rv.innerHTML = v; rf.innerHTML = f; }
function idleResult() { if (S.loaded && !S.busy && balance() >= MIN_BET) setResult('', t('res.bet'), money(betFor(S.frac)), ''); }
export function setQuote(text) { quoteEl.textContent = text || ''; }
function countTo(target, ms, withSound) {
  const from = S.shown, start = performance.now();
  return new Promise(res => {
    let last = 0;
    (function step(now) {
      const p = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - p, 3);
      S.shown = from + (target - from) * e; balEl.innerHTML = money(S.shown);
      if (withSound && now - last > 45) { sfx.count(p); last = now; }
      if (p < 1) requestAnimationFrame(step); else { S.shown = target; renderWallet(); res(); }
    })(start);
  });
}
function setFrac(f) { S.frac = f; store.set('frac', f); renderBets(); idleResult(); }

// ---------- api для игр ----------
const WIN = t('quotes.win'), LOSE = t('quotes.lose'), PUSH = t('quotes.push');

export const api = {
  money, fmt, TK, sfx, refit, shake, pop, burst, burstAt, rain, showBanner, glitch, sleep, pick, setQuote, setResult,
  balance, MIN_BET,
  get busy() { return S.busy; },
  /** Текущая ставка с панели (0 — играть нельзя). */
  stake() { return S.loaded ? betFor(S.frac) : 0; },
  /** Снять ставку и закрыть интерфейс на время хода. false — денег нет или ход уже идёт. */
  begin(bet) {
    if (S.busy || !S.loaded || bet < MIN_BET || bet > balance()) return false;
    S.busy = true; S.net -= bet; S.roundBet = bet; S.roundDate = S.date; S.gen++; S.open = true;
    document.body.dataset.outcome = 'playing';   // темы могут анимировать исход: playing | lose | push | small | big | jackpot
    renderSub(); renderBets(); countTo(balance(), 250, false);
    setResult('spin', t('res.bet'), money(bet), ''); setQuote('');
    return true;
  },
  /** Доставить к ставке посреди хода (удвоение). false — не хватает. */
  raise(extra) {
    if (!S.busy || extra > balance()) return false;
    S.net -= extra; S.roundBet += extra;
    renderSub(); countTo(balance(), 250, false);
    setResult('spin', t('res.bet'), money(S.roundBet), '');
    return true;
  },
  /** Конец хода. back — сколько вернуть игроку всего (0 — проигрыш, bet — ничья).
   *  kind: lose | push | small | big | jackpot. calc — строка расчёта под суммой. at — элемент-источник салюта. */
  async finish({ back, kind, calc = '', label = '', at = null, banner = null, quote = null }) {
    const bet = S.roundBet, profit = back - bet;
    S.open = false;
    S.net += back;
    document.body.dataset.outcome = kind;
    renderSub();
    const origin = at || $('game');
    if (kind === 'lose') {
      sfx.lose(); shake(6, 250);
      setResult('lose', t('res.lose'), money(bet, '−'), calc);
      setQuote(quote ?? pick(LOSE));
    } else if (kind === 'push') {
      sfx.push();
      setResult('push', t('res.push'), money(0, '±'), calc);
      setQuote(quote ?? pick(PUSH));
    } else {
      setResult('win', t('res.win'), money(profit, '+'), calc);
      pop(rv, kind === 'small' ? 1.3 : 1.6);
      setQuote(quote ?? pick(WIN));
      if (kind === 'small') { sfx.coin(); sfx.win(); burstAt(origin, 40, 'coin'); shake(8, 260); hype = Math.min(1, hype + .4); }
      else if (kind === 'big') { sfx.big(); burstAt(origin, 120, 'confetti'); burstAt(origin, 80, 'coin'); rain(120); shake(22, 700); hype = 1; showBanner(banner || 'BIG WIN'); }
      else { sfx.big(); burstAt(origin, 200, 'confetti'); rain(250); shake(30, 900); hype = 1; showBanner(banner || 'JACKPOT', null, 1800); }
    }
    postRound({ game: api.current.id, bet, back, label, date: S.roundDate });
    if (kind !== 'lose') { await countTo(balance(), kind === 'small' || kind === 'push' ? 700 : 1600, kind !== 'push'); pop(balEl, kind === 'big' || kind === 'jackpot' ? 1.45 : 1.15); }
    S.busy = false; renderWallet(); renderBets();
  },
  /** Подпись и доступность главной кнопки (пробел). inRound — кнопка работает и посреди хода. */
  setPrimary(label, enabled = true, { inRound = false } = {}) { primaryLabel = label; primaryEnabled = enabled; primaryInRound = inRound; renderBets(); },
  current: null,
};

async function postRound(round) {
  S.pending++;
  try {
    const r = await fetch('/round', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(round) });
    if (r.ok) applyState(await r.json(), true);
  } catch {} finally { S.pending--; }
}

// Закрыл вкладку или F5 посреди хода — ставка сгорает, как если бы встал из-за стола.
addEventListener('pagehide', () => {
  if (!S.open) return;
  const round = { game: api.current.id, bet: S.roundBet, back: 0, label: t('fled'), date: S.roundDate };
  navigator.sendBeacon('/round', new Blob([JSON.stringify(round)], { type: 'application/json' }));
});

// ---------- сервер ----------
function applyState(d, fromRound = false, gen = S.gen) {
  if (!Array.isArray(d.sources)) return;
  // сервер помнит максимум за день: упавший источник не должен откусывать баланс
  S.sources = d.sources; S.earned = Math.max(d.total, d.today?.earned || 0); S.records = d.records; S.config = d.config || {}; S.date = d.date;
  // net — с сервера, кроме моментов, когда идёт ход или летит запрос (иначе мигнёт старое значение)
  // опрос, отправленный до начала хода, несёт net без этого хода (gen сменился) — его не берём
  if (!S.busy && gen === S.gen && (fromRound ? S.pending <= 1 : S.pending === 0)) S.net = d.today?.net ?? 0;
  S.today = d.today;
  const first = !S.loaded; S.loaded = true;
  if (!S.busy) { S.shown = balance(); renderWallet(); renderBets(); if (first || resEl.classList.contains('broke') && balance() >= MIN_BET) idleResult(); }
}
async function poll() {
  const gen = S.gen;
  try { const r = await fetch('/state', { cache: 'no-store' }); if (r.ok) applyState(await r.json(), false, gen); } catch {}
}

// ---------- вкладки игр ----------
const gameEl = $('game'), rulesEl = $('rules'), tabsEl = $('tabs');
function selectGame(id) {
  if (S.busy) return;
  const gm = GAMES.find(x => x.id === id) || GAMES[0];
  api.current?.unmount?.();
  gameEl.replaceChildren(); rulesEl.replaceChildren();
  gameEl.dataset.game = gm.id;
  api.current = gm; primaryLabel = gm.primaryLabel || 'SPIN'; primaryEnabled = true; primaryInRound = false;
  gm.mount(gameEl, rulesEl, api);
  store.set('game', gm.id);
  tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === gm.id));
  idleResult(); setQuote(''); renderBets(); refit();
}
for (const gm of GAMES) {
  const b = document.createElement('button'); b.dataset.id = gm.id; b.textContent = gm.title;
  b.onclick = () => { audio(); sfx.click(); selectGame(gm.id); b.blur(); };
  tabsEl.append(b);
}

// ---------- стол всегда в окне ----------
// Игра, табло и кнопки (ставки + главная) должны быть видны без прокрутки при любом окне примерно от 320×420.
// Пробуем ступени сжатия c1→c3 (index.html), для каждой меряем стол в масштабе 1 и берём ту, где масштаб крупнее;
// остаток добирает zoom всей сцены. Выплаты в ступени c2 уходят под кнопки — их можно докрутить, они не обязательны.
const STEPS = [[], ['c1'], ['c1', 'c2'], ['c1', 'c2', 'c3']];
function need() {
  const first = [...stage.children].find(e => getComputedStyle(e).position !== 'absolute');   // кошелёк в c1 висит в углу, не в потоке
  const top = first.getBoundingClientRect().top, cs = getComputedStyle(stage);
  const bottom = Math.max(...['.controls', '.machine'].map(q => document.querySelector(q).getBoundingClientRect().bottom));
  const w = Math.max(...['.machine', '.controls', '#tabs', '.wallet .num'].map(q => document.querySelector(q).getBoundingClientRect().width));
  const pays = document.querySelector('.pays'), table = document.querySelector('.table');
  const side = !document.body.classList.contains('c2') && pays.getBoundingClientRect().top < document.querySelector('.machine').getBoundingClientRect().bottom - 1;
  return { h: bottom - top + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 8,
    w: Math.max(w, side ? table.getBoundingClientRect().width : 0) + 2 * parseFloat(cs.paddingLeft) };
}
var fitting = false;
function fit() {
  if (fitting) return; fitting = true;
  const cl = document.body.classList, foot = document.querySelector('.foot');
  let best = null;
  for (const step of STEPS) {
    cl.remove('c1', 'c2', 'c3'); cl.add(...step); stage.style.setProperty('--z', 1);
    const n = need(), fixedFoot = getComputedStyle(foot).position === 'fixed' ? foot.offsetHeight + 12 : 0;
    const z = Math.min(1, (innerHeight - fixedFoot) / n.h, innerWidth / n.w);
    if (!best || z > best.z + .02) best = { step, z };
    if (z >= 1) break;
  }
  cl.remove('c1', 'c2', 'c3'); cl.add(...best.step);
  stage.style.setProperty('--z', Math.max(.3, Math.floor(best.z * 1000) / 1000));
  fitting = false;
}
var fitQueued = false;   // var: refit зовут рендеры выше по файлу
export function refit() { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fit(); }); } }
addEventListener('resize', refit);
document.fonts?.ready.then(refit);
new ResizeObserver(refit).observe(gameEl);

// ---------- ввод ----------
document.querySelectorAll('.bet').forEach(b => b.addEventListener('click', () => { audio(); setFrac(Number(b.dataset.f)); sfx.click(); b.blur(); }));
primaryBtn.addEventListener('click', () => { audio(); if (!primaryBtn.disabled) api.current.primary(); primaryBtn.blur(); });
const muteBtn = $('mute');
const renderMute = () => { muteBtn.textContent = muted ? '🔇' : '🔊'; };
muteBtn.addEventListener('click', () => { muted = !muted; store.set('muted', muted); renderMute(); muteBtn.blur(); });
$('shareBtn').addEventListener('click', () => { audio(); openShare(S, api); });
// язык: кнопка с кодом текущего, по клику — список; выбор помнится и перекрывает язык браузера (?lang= в адресе — всё равно главнее)
const langBtn = $('langBtn'), langMenu = $('langMenu');
langBtn.textContent = SHORT[lang];
for (const l of LANGS) {
  const b = document.createElement('button'); b.textContent = NAMES[l]; b.lang = l; b.classList.toggle('on', l === lang);
  b.onclick = () => {
    if (S.busy) return;
    store.set('lang', l);
    const u = new URL(location.href); if (u.searchParams.has('lang')) u.searchParams.set('lang', l);
    location.replace(u);
  };
  langMenu.append(b);
}
langBtn.addEventListener('click', e => { if (S.busy) return; e.stopPropagation(); audio(); sfx.click(); langMenu.classList.toggle('open'); langBtn.blur(); });
addEventListener('click', e => { if (!e.target.closest('#langMenu')) langMenu.classList.remove('open'); });
$('recBtn').addEventListener('click', () => { audio(); openRecords(); });
addEventListener('keydown', e => {
  if (e.repeat || e.target.closest?.('input, textarea')) return;
  if (document.body.classList.contains('modal')) { if (e.code === 'Escape') closeModal(); return; }
  audio();
  const map = { Digit1: .1, Digit2: .25, Digit3: .5, Digit4: 1 };
  if (e.code in map && !S.busy) { setFrac(map[e.code]); sfx.click(); flash(document.querySelector(`.bet[data-f="${map[e.code]}"]`)); return; }
  if ((e.code === 'Space' || e.code === 'Enter') && !primaryBtn.disabled) { e.preventDefault(); flash(primaryBtn); api.current.primary(); return; }
  if (e.code === 'KeyM') { muteBtn.click(); return; }
  const k = api.current?.keys?.[e.code];
  if (k) { e.preventDefault(); k(); }
});
function flash(b) { if (!b) return; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 90); }

// ---------- модалки: рекорды ----------
export function openModal(node) { const m = $('modal'); m.replaceChildren(node); document.body.classList.add('modal'); }
export function closeModal() { document.body.classList.remove('modal'); $('modal').replaceChildren(); }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
function openRecords() {
  const r = S.records || {}, d = S.today || {};
  const box = document.createElement('div'); box.className = 'sheet records';
  const row = (k, v, sub = '', tone = '') => `<div class="rrow"><span class="rlabel">${k}</span><b class="rvalue ${tone}">${v}</b>${sub ? `<small class="rsub">${sub}</small>` : ''}</div>`;
  const tone = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
  const signed = n => money(n, n > 0 ? '+' : n < 0 ? '−' : '');
  const title = id => GAMES.find(gm => gm.id === id)?.title || id;
  const shot = x => x ? `${esc([title(x.game), x.label].filter(Boolean).join(' · '))}<time>${esc([x.date, x.at].filter(Boolean).join(' '))}</time>` : '';
  box.innerHTML = `<h2>${t('rec.title')}</h2><div class="records-list">
    ${row(t('rec.bestWin'), r.best_win ? signed(r.best_win.profit) : '—', shot(r.best_win), tone(r.best_win?.profit))}
    ${row(t('rec.worstLoss'), r.worst_loss ? signed(r.worst_loss.profit) : '—', shot(r.worst_loss), tone(r.worst_loss?.profit))}
    ${row(t('rec.bestDay'), r.best_day ? signed(r.best_day.net) : '—', esc(r.best_day?.date || ''), tone(r.best_day?.net))}
    ${row(t('rec.worstDay'), r.worst_day ? signed(r.worst_day.net) : '—', esc(r.worst_day?.date || ''), tone(r.worst_day?.net))}
    ${row(t('rec.mostEarned'), r.most_earned ? money(r.most_earned.earned) : '—', esc(r.most_earned?.date || ''), r.most_earned?.earned > 0 ? 'earned' : '')}
    ${row(t('rec.broke'), r.broke ?? 0)}
    ${row(t('rec.rounds'), r.rounds ?? 0, t('rec.days', { n: r.days_played ?? 0 }))}
    </div><h3>${t('rec.today')}</h3><div class="records-list">
    ${row(t('rec.todayRounds'), d.rounds ?? 0, d.rounds ? t('rec.won', { n: d.won_rounds }) : '')}
    ${row(t('rec.wagered'), money(d.wagered ?? 0))}</div>`;
  const close = document.createElement('button'); close.className = 'close'; close.textContent = '×'; close.onclick = closeModal;
  box.prepend(close);
  openModal(box);
}

// ---------- переключатель тем ----------
export function registerThemes(list) { THEMES.splice(0, THEMES.length, ...list); }
function renderThemeSwitch() {
  const box = $('themes'); box.replaceChildren();
  if (THEMES.length < 2) return;
  for (const t of THEMES) {
    const b = document.createElement('button'); b.dataset.id = t.id; b.textContent = t.name; b.title = t.hint || '';
    b.onclick = () => { applyTheme(t.id); b.blur(); };
    box.append(b);
  }
}

// ---------- старт ----------
const themesList = await fetch('themes/themes.json').then(r => r.ok ? r.json() : null).catch(() => null);
if (Array.isArray(themesList) && themesList.length) registerThemes(themesList);
renderThemeSwitch();
await applyTheme(params.get('theme') || store.get('theme', THEMES[0].id));
renderMute(); renderWallet(); renderBets();
selectGame(params.get('game') || store.get('game', 'slots'));
requestAnimationFrame(frame);
poll(); setInterval(poll, 5000);
