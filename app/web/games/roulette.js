// Рулетка: американское колесо (0, 00), одна ставка на спин. Перекос казино 5.26%.
import { tone } from '../core.js';
import { t, lang } from '../i18n.js';

const ORDER = ['0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22', '34', '15', '3', '24', '36', '13', '1',
  '00', '27', '10', '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35', '14', '2'];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const N = ORDER.length, PA = 2 * Math.PI / N, TAU = 2 * Math.PI;
const colorOf = p => p === '0' || p === '00' ? 'green' : RED.has(+p) ? 'red' : 'black';
const numOf = p => p === '0' || p === '00' ? 0 : +p;   // 0 — зеро, внешние ставки на нём мимо

// внешние ставки: k — во сколько раз вернуть ставку, row — строка таблицы выплат
const OUT = {
  red:   { t: t('rl.red'), k: 2, row: 'color',  win: n => RED.has(n) },
  black: { t: t('rl.black'), k: 2, row: 'color',  win: n => !RED.has(n) },
  even:  { t: t('rl.even'), k: 2, row: 'parity', win: n => n % 2 === 0 },
  odd:   { t: t('rl.odd'),  k: 2, row: 'parity', win: n => n % 2 === 1 },
  low:   { t: '1–18',    k: 2, row: 'half',   win: n => n <= 18 },
  high:  { t: '19–36',   k: 2, row: 'half',   win: n => n >= 19 },
  d1:    { t: '1–12',    k: 3, row: 'dozen',  win: n => n <= 12 },
  d2:    { t: '13–24',   k: 3, row: 'dozen',  win: n => n >= 13 && n <= 24 },
  d3:    { t: '25–36',   k: 3, row: 'dozen',  win: n => n >= 25 },
};
export function judge(bet, p) {
  if (ORDER.includes(bet)) return { win: bet === p, k: 36, row: 'n', kind: 'jackpot' };
  const b = OUT[bet], n = numOf(p);
  return { win: n > 0 && b.win(n), k: b.k, row: b.row, kind: b.k === 3 ? 'big' : 'small' };
}
const betName = b => ORDER.includes(b) ? b : OUT[b].t;

const forced = new URLSearchParams(location.search).get('rforce');
const FORCE = ORDER.includes(forced) ? forced : null;

// геометрия колеса (viewBox -100..100)
const RR = 89, RP = 62;            // радиус дорожки шарика и кармана
const IDLE = .12;                  // рад/с, колесо всегда чуть крутится
const HOPS = [[3, 1, 0], [4, 2, 1, 0], [5, 2, 3, 1, 0], [2, 4, 1, 0], [4, 1, 2, 0], [6, 3, 1, 2, 0], [3, 5, 2, 1, 0]];

const CSS = `
  .rl { --rl-red: var(--roulette-red, #d23b3b); --rl-black: var(--roulette-black, #1b1b1f); --rl-green: var(--roulette-green, #1f8a4c);
    --rl-ink: var(--roulette-ink, #f4f1ea); --rl-h: 15px; --rl-o: 28px; --rl-fs: 13px; --rl-chip: 22px;
    width: min(640px, calc(100vw - 68px)); display: flex; gap: 16px; align-items: center; }
  .rl-wheel { width: 250px; height: 250px; flex: none; overflow: visible; transition: transform .9s cubic-bezier(.2,.8,.2,1), filter .3s; }
  .rl.tense .rl-wheel { transform: scale(1.06); }
  .rl-wheel .rim { fill: var(--deep); stroke: var(--edge); stroke-width: 3; }
  .rl-wheel .track { fill: color-mix(in srgb, var(--panel) 85%, var(--ink)); }
  .rl-wheel .sep { fill: var(--edge); }
  .rl-wheel .p-red { fill: var(--rl-red); } .rl-wheel .p-black { fill: var(--rl-black); } .rl-wheel .p-green { fill: var(--rl-green); }
  .rl-wheel .p-none { fill: var(--deep); }
  .rl-wheel .q-red { fill: color-mix(in srgb, var(--rl-red) 45%, var(--deep)); }
  .rl-wheel .q-black { fill: color-mix(in srgb, var(--rl-black) 60%, var(--deep)); }
  .rl-wheel .q-green { fill: color-mix(in srgb, var(--rl-green) 45%, var(--deep)); }
  .rl-wheel .fret { stroke: color-mix(in srgb, var(--gold) 55%, transparent); stroke-width: .7; }
  .rl-wheel .num { fill: var(--rl-ink); font: 8.5px var(--font-display); text-anchor: middle; dominant-baseline: central; }
  .rl-wheel .cone { fill: var(--panel); stroke: var(--edge); stroke-width: 2; }
  .rl-wheel .spoke { stroke: var(--gold); stroke-width: 3; stroke-linecap: round; }
  .rl-wheel .knob { fill: var(--gold); }
  .rl-wheel .hl { fill: color-mix(in srgb, var(--gold) 30%, transparent); stroke: var(--gold); stroke-width: 2.4; opacity: 0;
    filter: drop-shadow(0 0 4px var(--gold)); }
  .rl-wheel .hl.on { opacity: 1; animation: rl-blink .4s ease-in-out 4 alternate; }
  .rl-wheel .hub { stroke: var(--edge); stroke-width: 3; transition: stroke .15s; }
  .rl-wheel .hub.hot { stroke: var(--gold); filter: drop-shadow(0 0 6px var(--gold)); }
  .rl-wheel .hubnum { fill: var(--rl-ink); font: 24px var(--font-display); text-anchor: middle; dominant-baseline: central; }
  .rl-wheel .ball { fill: var(--rl-ink); stroke: rgba(0,0,0,.45); stroke-width: .8; }
  .rl-wheel .shadow { fill: rgba(0,0,0,.35); }
  @keyframes rl-blink { to { opacity: .35; } }

  .rl-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .rl-hist { display: flex; gap: 4px; height: 28px; align-items: center; overflow: hidden; }
  .rl-hist i { font: normal 700 12px var(--font-mono); color: var(--rl-ink); min-width: 24px; height: 22px; padding: 0 4px; border-radius: 6px;
    display: grid; place-items: center; flex: none; }
  .rl-hist i:first-child { min-width: 32px; height: 28px; font-size: 15px; box-shadow: inset 0 0 0 2px var(--gold); }
  .rl-hist i:nth-child(n+6) { opacity: .6; }
  .rl .red { background: var(--rl-red); } .rl .black { background: var(--rl-black); } .rl .green { background: var(--rl-green); }

  .rl-board { display: grid; grid-template-columns: 1.15fr repeat(12, 1fr); grid-template-rows: repeat(6, var(--rl-h)) var(--rl-o) var(--rl-o);
    gap: 3px; padding: 6px; border-radius: 10px; background: color-mix(in srgb, var(--rl-green) 22%, var(--deep)); }
  .rl-c { padding: 0; border-radius: 5px; font: var(--rl-fs) var(--font-display); color: var(--rl-ink); background: transparent; display: flex;
    align-items: center; justify-content: center; position: relative; white-space: nowrap; min-width: 0;
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--rl-ink) 20%, transparent); transition: opacity .25s, filter .25s; }
  .rl-c.out { color: var(--ink); font-size: calc(var(--rl-fs) - 2px); }
  .rl-c:hover { filter: brightness(1.3); }
  .rl-c .dia { width: 14px; height: 14px; transform: rotate(45deg); border-radius: 2px; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--rl-ink) 35%, transparent); }
  .rl-c.cur { box-shadow: inset 0 0 0 2px var(--rl-ink), 0 0 12px color-mix(in srgb, var(--rl-ink) 70%, transparent); z-index: 1; filter: brightness(1.35); }
  .rl-c.hit { box-shadow: inset 0 0 0 3px var(--gold), 0 0 18px var(--gold); z-index: 2; animation: rl-hit .35s ease-in-out 4 alternate; }
  .rl-c.won { box-shadow: inset 0 0 0 3px var(--gold), 0 0 26px 6px color-mix(in srgb, var(--gold) 70%, transparent); z-index: 2;
    animation: rl-hit .3s ease-in-out 6 alternate; }
  .rl-c.off { opacity: .3; filter: saturate(0); }
  @keyframes rl-hit { to { transform: scale(1.15); filter: brightness(1.5); } }
  .rl-chip { position: absolute; width: var(--rl-chip); height: var(--rl-chip); border-radius: 50%; display: grid; place-items: center;
    background: var(--coin); color: var(--coin-edge); font-size: calc(var(--rl-chip) * .55); z-index: 3; pointer-events: none;
    box-shadow: 0 3px 0 var(--coin-edge), inset 0 0 0 2px color-mix(in srgb, var(--coin-edge) 60%, transparent); }
  .rl-c.out .rl-chip { top: -7px; right: -5px; }
  .rl.tense .rl-chip { animation: rl-hit .25s ease-in-out infinite alternate; }

  @media (max-width: 760px) {
    .rl { flex-direction: column; gap: 10px; --rl-h: 13px; --rl-o: 26px; --rl-fs: 11px; --rl-chip: 18px; }
    .rl-wheel { width: 230px; height: 230px; }
    .rl-side { width: 100%; }
    .rl-c .dia { width: 11px; height: 11px; }
  }
  /* короткое окно (body.c3 от fit в core.js): колесо и поле рядом при любой ширине — стол целиком уменьшит zoom */
  body.c3 .rl { flex-direction: row; width: 600px; gap: 14px; }
  body.c3 .rl-wheel { width: 220px; height: 220px; }
  body.c3 .rl-side { width: auto; }
`;

const NS = 'http://www.w3.org/2000/svg';
const xy = (r, a) => [+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a)).toFixed(2)];
const pt = (r, a) => xy(r, a).join(' ');
const wedge = (r1, r2, a0, a1) => `M${pt(r2, a0)}A${r2} ${r2} 0 0 1 ${pt(r2, a1)}L${pt(r1, a1)}A${r1} ${r1} 0 0 0 ${pt(r1, a0)}Z`;
const mod = (a, m) => ((a % m) + m) % m;
const pocketAt = phi => ORDER[Math.round(mod(phi, TAU) / PA) % N];

// состояние живёт в модуле: переживает переключение вкладок
let target = null;                 // выбранная ставка: '17' | '00' | 'red' | 'd2' …
const hist = [];
const W = { th: Math.random() * TAU, boost: 0, phi: Math.floor(Math.random() * N) * PA, r: RP };

let api, root, svg, rot, ball, shadow, hub, hubNum, hl, histEl, cells, rowEls, raf, last, spin;

function wheelSvg() {
  let w = '', q = '', fr = '', nums = '';
  ORDER.forEach((p, i) => {
    const a0 = (i - .5) * PA, a1 = (i + .5) * PA, c = colorOf(p);
    w += `<path class="p-${c}" d="${wedge(70, 84, a0, a1)}"/>`;
    q += `<path class="q-${c}" d="${wedge(52, 70, a0, a1)}"/>`;
    fr += `<path class="fret" d="M${pt(52, a0)}L${pt(84, a0)}"/>`;
    nums += `<text class="num" transform="rotate(${(i * PA * 180 / Math.PI).toFixed(2)}) translate(0 -77)">${p}</text>`;
  });
  const spokes = [0, 1, 2, 3].map(k => { const a = k * Math.PI / 2, [cx, cy] = xy(45, a);
    return `<path class="spoke" d="M${pt(26, a)}L${pt(44, a)}"/><circle class="knob" r="4" cx="${cx}" cy="${cy}"/>`; }).join('');
  return `<circle class="rim" r="98"/><circle class="track" r="95"/><circle class="sep" r="85.5"/>
    <g class="rot">${w}${q}${fr}${nums}<path class="hl"/><circle class="cone" r="50"/>${spokes}</g>
    <circle class="hub p-none" r="26"/><text class="hubnum"></text>
    <circle class="shadow" r="4.6"/><circle class="ball" r="4.4"/>`;
}

function draw() {
  rot.setAttribute('transform', `rotate(${(W.th * 180 / Math.PI).toFixed(3)})`);
  const a = W.th + W.phi;
  const [x, y] = xy(W.r, a);
  ball.setAttribute('cx', x); ball.setAttribute('cy', y);
  shadow.setAttribute('cx', x + 1.4); shadow.setAttribute('cy', y + 2);
}
function showPocket(p, hot = false) {
  hub.setAttribute('class', `hub p-${p ? colorOf(p) : 'none'}${hot ? ' hot' : ''}`);
  hubNum.textContent = p || '';
  cells && Object.entries(cells).forEach(([k, el]) => el.classList.toggle('cur', k === p && !!spin));
}

// путь шарика в системе колеса: phi(t) — угол относительно колеса, r(t) — радиус
function plan(p) {
  const hops = api.pick(HOPS), phiT = ORDER.indexOf(p) * PA, phiB = phiT + hops[0] * PA;
  const tB = 3.8 + Math.random() * .6;
  const D = mod(W.phi - phiB, TAU) + TAU * (7 + Math.floor(Math.random() * 2));
  const d = hops.slice(1).map((_, j) => .44 * Math.pow(.8, j)), amp = d.map((_, j) => 9 * Math.pow(.66, j));
  return { p, hops, phiT, phiB, tB, D, d, amp, T: tB + d.reduce((s, x) => s + x, 0), hop: -1, tick: 0, idx: -1 };
}
function ballAt(s, t) {
  if (t < s.tB) {
    const u = t / s.tB, K = .1, f = (1 - u) ** 2 * (1 - K) + (1 - u) * K;
    let r = RR;
    if (t < .35) r = RP + (RR - RP) * (1 - (1 - t / .35) ** 2);
    const tD = s.tB - .8;
    if (t > tD) { const v = (t - tD) / .8; r = RR - (RR - RP) * v * v + 3 * Math.abs(Math.sin(v * Math.PI * 3)) * (1 - v); }
    return { phi: s.phiB + s.D * f, r, hop: -1 };
  }
  let t0 = s.tB;
  for (let j = 0; j < s.d.length; j++) {
    if (t < t0 + s.d[j]) {
      const u = (t - t0) / s.d[j], e = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      return { phi: s.phiT + PA * (s.hops[j] + (s.hops[j + 1] - s.hops[j]) * e), r: RP + s.amp[j] * Math.sin(Math.PI * u), hop: j };
    }
    t0 += s.d[j];
  }
  return { phi: s.phiT, r: RP, hop: s.d.length, done: true };
}

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  W.th += (IDLE + W.boost) * dt; W.boost *= Math.exp(-dt / 2.6);
  if (spin) {
    const s = spin, t = (now - s.t0) / 1000, b = ballAt(s, t);
    W.phi = b.phi; W.r = b.r;
    const idx = Math.round(mod(b.phi, TAU) / PA) % N;
    if (idx !== s.idx && now - s.tick > 38) {   // шарик прошёл карман: тик, цифра в центре, курсор на поле
      s.idx = idx; s.tick = now;
      const p = ORDER[idx], inPocket = t >= s.tB;
      tone(700 + 1100 * Math.min(1, t / s.T), .03, 'square', inPocket ? .04 : .025);
      showPocket(p, inPocket && judge(target, p).win);
    }
    if (b.hop !== s.hop) {                       // удар о лунку: глухой стук
      if (b.hop >= 0) { tone(170 - b.hop * 12, .12, 'sine', .25, -50); tone(2600, .015, 'square', .04); }
      if (b.hop === 0) root.classList.add('tense');
      s.hop = b.hop;
    }
    if (b.done) { W.phi = mod(s.phiT, TAU); spin = null; s.resolve(); }
  }
  draw();
  raf = requestAnimationFrame(frame);
}

function renderHist() {
  histEl.replaceChildren(...hist.map(p => { const i = document.createElement('i'); i.className = colorOf(p); i.textContent = p; return i; }));
}
function placeChip(key) {
  root.querySelector('.rl-chip')?.remove();
  Object.values(cells).forEach(c => c.classList.remove('won', 'off'));
  const chip = document.createElement('div'); chip.className = 'rl-chip'; chip.innerHTML = api.TK;
  cells[key].append(chip);
}
function choose(key) {
  if (api.busy) return;
  target = key; placeChip(key);
  api.sfx.chip(); api.pop(cells[key].querySelector('.rl-chip'), 1.5);
  api.setPrimary(t('rl.spin'), true);
}

function buildBoard() {
  const board = document.createElement('div'); board.className = 'rl-board';
  cells = {};
  const cell = (key, cls, html, col, row) => {
    const b = document.createElement('button'); b.className = 'rl-c ' + cls; b.innerHTML = html;
    b.style.gridColumn = col; b.style.gridRow = row;
    b.onclick = () => { choose(key); b.blur(); };
    board.append(b); cells[key] = b;
  };
  cell('0', 'green', '0', '1', '1 / span 3');
  cell('00', 'green', '00', '1', '4 / span 3');
  for (let c = 1; c <= 12; c++) for (let r = 1; r <= 3; r++) {
    const n = String(3 * c - (r - 1));
    cell(n, colorOf(n), n, String(c + 1), `${2 * r - 1} / span 2`);
  }
  ['d1', 'd2', 'd3'].forEach((k, i) => cell(k, 'out', OUT[k].t, `${2 + 4 * i} / span 4`, '7'));
  const dia = c => `<i class="dia ${c}"></i>`;
  [['low', '1–18'], ['even', OUT.even.t.toLocaleUpperCase(lang)], ['red', dia('red')], ['black', dia('black')], ['odd', OUT.odd.t.toLocaleUpperCase(lang)], ['high', '19–36']]
    .forEach(([k, h], i) => cell(k, 'out', h, `${2 + 2 * i} / span 2`, '8'));
  return board;
}

function buildRules(rules) {
  rules.innerHTML = `<div class="h">${t('pays')}</div>`;
  rowEls = {};
  const row = (key, html, x) => {
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = `<div class="s">${html}</div><div class="x">${x}</div>`;
    rules.append(r); if (key) rowEls[key] = r;
    return r;
  };
  const bg = { red: 'var(--roulette-red, #d23b3b)', black: 'var(--roulette-black, #1b1b1f)', green: 'var(--roulette-green, #1f8a4c)' };
  const pill = (c, t) => `<span style="padding:0 6px;border-radius:5px;color:var(--roulette-ink, #f4f1ea);background:${bg[c]}">${t}</span>`;
  row('n', t('rl.number'), '×36');
  row('dozen', t('rl.dozen'), '×3');
  row('color', `${pill('red', '◆')}${pill('black', '◆')}`, '×2');
  row('parity', `${OUT.even.t} · ${OUT.odd.t}`, '×2');
  row('half', '1–18 · 19–36', '×2');
  row(null, `${pill('green', '0')}${pill('green', '00')} ${t('rl.outside')}`, '×0').style.opacity = .55;
}

export default {
  id: 'roulette', title: t('rl.title'), primaryLabel: t('rl.spin'),
  mount(el, rules, a) {
    api = a;
    root = document.createElement('div'); root.className = 'rl';
    const style = document.createElement('style'); style.textContent = CSS;
    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'rl-wheel'); svg.setAttribute('viewBox', '-100 -100 200 200');
    svg.innerHTML = wheelSvg();
    [rot, ball, shadow, hub, hubNum, hl] = ['.rot', '.ball', '.shadow', '.hub', '.hubnum', '.hl'].map(s => svg.querySelector(s));
    const side = document.createElement('div'); side.className = 'rl-side';
    histEl = document.createElement('div'); histEl.className = 'rl-hist';
    side.append(histEl, buildBoard());
    root.append(style, svg, side);
    el.append(root);
    buildRules(rules);

    renderHist(); showPocket(hist[0]);
    if (hist[0]) hl.setAttribute('d', wedge(52, 84, (ORDER.indexOf(hist[0]) - .5) * PA, (ORDER.indexOf(hist[0]) + .5) * PA));
    if (target) placeChip(target);
    api.setPrimary(t('rl.spin'), !!target);
    last = performance.now(); raf = requestAnimationFrame(frame);
  },
  unmount() { cancelAnimationFrame(raf); spin = null; root?.remove(); },
  async primary() {
    if (!target) return;
    const bet = api.stake();
    if (!api.begin(bet)) return;
    const key = target, betCell = cells[key];
    Object.values(cells).forEach(c => c.classList.remove('won', 'off', 'hit', 'cur'));
    Object.values(rowEls).forEach(r => r.classList.remove('lit'));
    hl.classList.remove('on');

    const p = FORCE ?? ORDER[Math.floor(Math.random() * N)];
    W.boost = 2.4;
    await new Promise(resolve => { spin = { ...plan(p), t0: performance.now(), resolve }; });

    // шарик лёг: стук, пауза, потом приговор
    root.classList.remove('tense');
    const i = ORDER.indexOf(p);
    hl.setAttribute('d', wedge(52, 84, (i - .5) * PA, (i + .5) * PA)); hl.classList.add('on');
    hist.unshift(p); hist.length = Math.min(hist.length, 10); renderHist();
    api.pop(histEl.firstChild, 1.4);
    const res = judge(key, p);
    showPocket(p, res.win); cells[p].classList.add('hit');
    api.sfx.thud(2); api.shake(5, 180);
    await api.sleep(res.win ? 320 : 160);

    if (res.win) { betCell.classList.add('won'); rowEls[res.row].classList.add('lit'); }
    else betCell.classList.add('off');
    const back = res.win ? bet * res.k : 0, kind = res.win ? res.kind : 'lose';
    const zeroTax = !res.win && numOf(p) === 0 && !ORDER.includes(key);
    await api.finish({
      back, kind, at: betCell,
      label: t('rl.label', { p, bet: betName(key) }),
      calc: res.win ? `${api.money(bet)} × ${res.k} = ${api.money(back)}` : '',
      banner: kind === 'jackpot' ? `${p} ×36` : t('rl.dozenBanner'),
      quote: zeroTax ? api.pick(t('rl.zero')).replace('{p}', p) : null,
    });
  },
};
