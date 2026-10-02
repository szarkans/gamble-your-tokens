// Слоты: три барабана, линия выплаты. Возврат игроку ~94.8% (тикет 05).
import { t } from '../i18n.js';

const SYM = [
  { t: '7',      c: 'var(--sym-7, #ff4d5e)',    m: 20, w: 3 },
  { t: '$',      c: 'var(--sym-cash, #3ddc84)', m: 10, w: 4 },
  { t: '✓',      c: 'var(--sym-ok, #4cc9ff)',   m: 6,  w: 5, sub: 'LGTM' },
  { t: '429',    c: 'var(--sym-429, #ffcc33)',  m: 4,  w: 6, long: true },
  { t: 'rm -rf', c: 'var(--sym-rm, #ff8a3d)',   m: 50, w: 1, long: true },
];
const PAIR = 1.5;
const FORCE = new URLSearchParams(location.search).get('force')?.split(',').map(Number);

const CSS = `
  .slots { display: flex; gap: 12px; position: relative; }
  .slots .reel { width: var(--cell); height: var(--cell); overflow: hidden; border-radius: 12px; position: relative; background: var(--reel-bg, var(--deep));
    box-shadow: inset 0 0 0 3px rgba(0,0,0,.6), inset 0 12px 18px rgba(0,0,0,.45), inset 0 -12px 18px rgba(0,0,0,.45); transition: opacity .25s, filter .25s; }
  .slots .reel.off { opacity: .3; filter: saturate(0); }
  .slots .reel.won { box-shadow: inset 0 0 0 4px var(--gold), 0 0 26px 4px color-mix(in srgb, var(--gold) 55%, transparent); }
  .slots .payline { position: absolute; left: -14px; right: -14px; top: 50%; height: 0; border-top: 3px dashed color-mix(in srgb, var(--gold) 35%, transparent); pointer-events: none; z-index: 2; }
  .slots .payline::before, .slots .payline::after { content: ''; position: absolute; top: -9px; border: 7px solid transparent; }
  .slots .payline::before { left: -4px; border-left-color: var(--gold); }
  .slots .payline::after { right: -4px; border-right-color: var(--gold); }
  .slots .payline.hot { border-top: 4px solid var(--gold); filter: drop-shadow(0 0 6px var(--gold)); }
  .slots .strip { position: absolute; left: 0; top: 0; width: 100%; will-change: transform; }
  .slots .sym { height: var(--cell); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: calc(var(--cell) * .48); line-height: 1;
    text-shadow: 0 4px 0 rgba(0,0,0,.35); }
  .slots .sym.long { font-size: calc(var(--cell) * .24); }
  .slots .sym .t { white-space: nowrap; }   /* «rm -rf» — одной строкой; не влезает — fitSyms ужимает */
  .slots .sym small { font-size: calc(var(--cell) * .12); opacity: .75; margin-top: 4px; letter-spacing: .1em; }
`;

let root, reels, payline, rowEls, api;

function roll() {
  if (FORCE) return FORCE;
  const total = SYM.reduce((s, x) => s + x.w, 0);
  return [0, 1, 2].map(() => { let r = Math.random() * total; return SYM.findIndex(s => (r -= s.w) < 0); });
}
function judge(r) {
  if (r[0] === r[1] && r[1] === r[2]) return { mult: SYM[r[0]].m, hits: [0, 1, 2], row: r[0], kind: r[0] === 4 ? 'jackpot' : 'big' };
  if (r[0] === r[1]) return { mult: PAIR, hits: [0, 1], row: 'pair', kind: 'small' };
  if (r[1] === r[2]) return { mult: PAIR, hits: [1, 2], row: 'pair', kind: 'small' };
  return { mult: 0, hits: [], row: null, kind: 'lose' };
}
function symEl(i) {
  const s = SYM[i], d = document.createElement('div');
  d.className = 'sym' + (s.long ? ' long' : '');
  d.style.color = s.c;
  d.style.background = `radial-gradient(circle, color-mix(in srgb, ${s.c} 22%, transparent) 0%, transparent 75%)`;
  const tx = document.createElement('span'); tx.className = 't'; tx.textContent = s.t; d.append(tx);
  if (s.sub) { const sm = document.createElement('small'); sm.textContent = s.sub; d.append(sm); }
  return d;
}
// длинные символы («rm -rf», «429») ужать до ширины барабана: шрифт темы может быть широким, перенос ломает символ
function fitSyms(strip) {
  for (const d of strip.children) {
    if (!d.classList.contains('long')) continue;
    const tx = d.firstChild; tx.style.transform = '';
    if (!d.clientWidth || !tx.scrollWidth) continue;
    const k = Math.min(1, d.clientWidth * .86 / tx.scrollWidth);
    if (k < 1) tx.style.transform = `scale(${k})`;
  }
}
async function spinReel(r, target, i) {
  const n = 18 + i * 7;
  const items = [r.cur, ...Array.from({ length: n }, () => Math.floor(Math.random() * SYM.length)), target];
  r.strip.replaceChildren(...items.map(symEl)); fitSyms(r.strip);
  const h = r.strip.firstElementChild.offsetHeight;   // шаг ленты — высота символа, а не окна барабана (рамка темы его ужимает)
  const dist = (items.length - 1) * h;
  await r.strip.animate([
    { transform: 'translateY(0)', filter: 'blur(0)' },
    { transform: `translateY(${-dist * .12}px)`, filter: 'blur(3px)', offset: .12 },
    { transform: `translateY(${-dist * .9}px)`, filter: 'blur(2px)', offset: .75 },
    { transform: `translateY(${-dist - h * .12}px)`, filter: 'blur(0)', offset: .93 },
    { transform: `translateY(${-dist}px)`, filter: 'blur(0)' },
  ], { duration: 900 + i * 420, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished;
  r.cur = target;
  r.strip.getAnimations().forEach(a => a.cancel());
  r.strip.replaceChildren(symEl(target)); fitSyms(r.strip);
  api.sfx.thud(i); api.shake(4 + i * 2, 160);
}

export default {
  id: 'slots', title: t('slots.title'), primaryLabel: 'SPIN',
  mount(el, rules, a) {
    api = a;
    root = document.createElement('div'); root.className = 'slots';
    const style = document.createElement('style'); style.textContent = CSS; root.append(style);
    payline = document.createElement('div'); payline.className = 'payline';
    reels = [0, 1, 2].map(i => {
      const reel = document.createElement('div'); reel.className = 'reel';
      const strip = document.createElement('div'); strip.className = 'strip';
      reel.append(strip); root.append(reel);
      const r = { reel, strip, cur: [3, 1, 2][i] };
      strip.replaceChildren(symEl(r.cur));
      return r;
    });
    root.append(payline);
    el.append(root);
    const refitSyms = () => reels.forEach(r => fitSyms(r.strip));
    refitSyms(); document.fonts?.ready.then(refitSyms);

    rules.innerHTML = `<div class="h">${t('pays')}</div>`;
    rowEls = {};
    const row = (key, cells, mult) => {
      const r = document.createElement('div'); r.className = 'row';
      const s = document.createElement('div'); s.className = 's';
      cells.forEach(([text, color]) => { const sp = document.createElement('span'); sp.textContent = text; sp.style.color = color; s.append(sp); });
      const x = document.createElement('div'); x.className = 'x'; x.textContent = '×' + mult;
      r.append(s, x); rules.append(r); rowEls[key] = r;
    };
    [4, 0, 1, 2, 3].forEach(i => { const s = SYM[i], t = s.t === 'rm -rf' ? 'rm' : s.t; row(i, [[t, s.c], [t, s.c], [t, s.c]], s.m); });
    row('pair', [[t('slots.pair'), 'var(--ink)']], PAIR);
  },
  unmount() { root?.remove(); },
  async primary() {
    const bet = api.stake();
    if (!api.begin(bet)) return;
    reels.forEach(r => r.reel.classList.remove('off', 'won'));
    payline.classList.remove('hot');
    Object.values(rowEls).forEach(r => r.classList.remove('lit'));

    const result = roll();
    const ticker = setInterval(api.sfx.tick, 55);
    await Promise.all(reels.map((r, i) => spinReel(r, result[i], i)));
    clearInterval(ticker);

    const { mult, hits, row, kind } = judge(result);
    const back = Math.floor(bet * mult);
    reels.forEach((r, i) => r.reel.classList.add(hits.includes(i) ? 'won' : 'off'));
    if (kind !== 'lose') { payline.classList.add('hot'); rowEls[row].classList.add('lit'); }
    const label = result.map(i => SYM[i].t).join(' ');
    if (kind === 'jackpot') { api.setQuote('rm -rf / --no-preserve-root'); await api.glitch(); }
    await api.finish({
      back, kind, label, at: root,
      calc: kind === 'lose' ? '' : `${api.money(bet)} × ${mult} = ${api.money(back)}`,
      banner: kind === 'jackpot' ? '×50 ROOT' : mult >= 20 ? 'JACKPOT' : 'BIG WIN',
    });
  },
};
