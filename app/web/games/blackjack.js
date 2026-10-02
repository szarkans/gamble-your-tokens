// Очко (блэкджек): шуз 6 колод, дилер добирает до 17 и стоит на любых 17, BJ 3:2, удвоение на первых двух.
// ?deck=A,K,9,7,5 — первые карты шуза по порядку раздачи (игрок, дилер, игрок, дилер, дальше добор). Масть можно дописать: Ah, 10s.
import { tone } from '../core.js';
import { t } from '../i18n.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 6, TOTAL = DECKS * 52, CUT = TOTAL / 4;
const BUST = t('bj.bust'), DEALER_BJ = t('bj.dealerBJQuotes');

const CSS = `
  .bj-table { position: relative; width: min(580px, calc(100vw - 72px)); display: flex; flex-direction: column; gap: 12px;
    --bj-w: clamp(50px, min(14vw, 9vh), 74px); --bj-h: calc(var(--bj-w) * 1.4); --bj-face: var(--card-face, #f6f3ec); }
  .bj-row { display: flex; align-items: center; gap: 12px; min-height: var(--bj-h); }
  .bj-dealer { padding-right: calc(var(--bj-w) + 12px); }
  .bj-score { flex: none; width: calc(var(--bj-w) * .95); height: 56px; border-radius: 10px; background: var(--deep); display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px; line-height: 1; transition: box-shadow .2s, background .2s; }
  .bj-score small { font: 700 10px var(--font-ui); letter-spacing: .18em; color: var(--dim); }
  .bj-score b { font-size: clamp(19px, 5.4vw, 27px); color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bj-score b.soft { font-size: clamp(14px, 4vw, 19px); }
  .bj-score.bust { background: color-mix(in srgb, var(--lose) 22%, var(--deep)); box-shadow: inset 0 0 0 3px var(--lose); }
  .bj-score.bust b { color: var(--lose); }
  .bj-score.top b { color: var(--gold); }
  .bj-score.bj { background: var(--gold); } .bj-score.bj b, .bj-score.bj small { color: var(--deep); }
  .bj-score.win { box-shadow: inset 0 0 0 3px var(--win); } .bj-score.win b { color: var(--win); }
  .bj-score.push { box-shadow: inset 0 0 0 3px var(--push); }

  .bj-hand { display: flex; align-items: center; min-width: 0; transition: opacity .35s, filter .35s; }
  .bj-hand:empty::before { content: ''; width: var(--bj-w); height: var(--bj-h); border-radius: calc(var(--bj-w) * .1);
    box-shadow: inset 0 0 0 2px var(--edge); }
  .bj-hand .bj-card + .bj-card { margin-left: calc(var(--bj-w) * -.42); }
  .bj-hand.many .bj-card + .bj-card { margin-left: calc(var(--bj-w) * -.6); }
  .bj-hand.dim { opacity: .4; filter: saturate(.2); }

  .bj-card { flex: none; width: var(--bj-w); height: var(--bj-h); perspective: 700px; position: relative; }
  .bj-in { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .42s cubic-bezier(.3,1.35,.5,1); }
  .bj-card.down .bj-in { transform: rotateY(180deg); }
  .bj-front, .bj-back { position: absolute; inset: 0; border-radius: calc(var(--bj-w) * .1); backface-visibility: hidden; -webkit-backface-visibility: hidden;
    box-shadow: -2px 0 0 rgba(0,0,0,.18), 0 3px 0 rgba(0,0,0,.35), 0 6px 14px rgba(0,0,0,.35); transition: box-shadow .25s; }
  .bj-front { background: var(--bj-face); color: var(--card-black, #16161a); overflow: hidden; }
  .bj-red .bj-front { color: var(--card-red, #d23b3b); }
  .bj-front::after { content: ''; position: absolute; inset: 0; background: var(--lose); opacity: 0; transition: opacity .3s; }
  .bj-back { transform: rotateY(180deg); border: calc(var(--bj-w) * .05) solid var(--bj-face); display: flex; align-items: center; justify-content: center; color: var(--bj-face);
    background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 72%, #000) 0 3px, var(--accent) 3px 7px); }
  .bj-back .tk, .bj-stack .tk { width: 40%; height: auto; margin: 0; filter: drop-shadow(0 2px 0 rgba(0,0,0,.45)); }
  .bj-c { position: absolute; top: 5%; left: 7%; display: flex; flex-direction: column; align-items: center; font-family: var(--font-display);
    font-size: calc(var(--bj-w) * .27); line-height: .95; letter-spacing: -.04em; }
  .bj-c i { font-style: normal; font-size: .78em; }
  .bj-c2 { top: auto; left: auto; bottom: 5%; right: 7%; transform: rotate(180deg); }
  .bj-pip { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: calc(var(--bj-w) * .5); }
  .bj-pip.ace { font-size: calc(var(--bj-w) * .72); }
  .bj-face { position: absolute; inset: 24% 24%; border: 2px solid currentColor; border-radius: 4px; display: flex; flex-direction: column; align-items: center;
    justify-content: center; font-family: var(--font-display); font-size: calc(var(--bj-w) * .32); line-height: .9;
    background: color-mix(in srgb, currentColor 10%, transparent); }
  .bj-face i { font-style: normal; font-size: .6em; }

  .bj-hand.bust .bj-front { box-shadow: 0 0 0 3px var(--lose), 0 0 18px color-mix(in srgb, var(--lose) 70%, transparent); }
  .bj-hand.bust .bj-front::after { opacity: .3; }
  .bj-hand.win .bj-front { box-shadow: 0 0 0 3px var(--win), 0 0 22px color-mix(in srgb, var(--win) 65%, transparent); }
  .bj-hand.gold .bj-front { box-shadow: 0 0 0 3px var(--gold), 0 0 28px var(--gold); }
  .bj-hand.push .bj-front { box-shadow: 0 0 0 3px var(--push); }

  .bj-shoe { position: absolute; top: 0; right: 0; width: var(--bj-w); height: var(--bj-h); padding: 6px; border-radius: 10px; background: var(--deep);
    box-shadow: inset 0 0 0 2px var(--edge); }
  .bj-stack { position: absolute; inset: 6px 6px 14px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--bj-face);
    background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--accent) 72%, #000) 0 3px, var(--accent) 3px 7px);
    border: 2px solid var(--bj-face); box-shadow: 2px 2px 0 var(--deep), 4px 4px 0 var(--bj-face), 6px 6px 0 var(--deep); }
  .bj-left { position: absolute; left: 6px; bottom: 5px; height: 3px; border-radius: 2px; background: var(--dim); transition: width .3s;
    max-width: calc(100% - 12px); }

  .bj-mid { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 48px; }
  .bj-bet { display: flex; align-items: center; gap: 10px; font-size: 20px; color: var(--ink); transition: opacity .3s, color .3s; font-variant-numeric: tabular-nums; }
  .bj-bet:empty { display: none; }
  .bj-bet.won { color: var(--win); } .bj-bet.lost { opacity: .35; }
  .bj-chips { position: relative; width: 32px; height: 32px; }
  .bj-chip { position: absolute; left: 0; top: 0; width: 32px; height: 32px; border-radius: 50%; background: var(--gold);
    border: 5px dashed color-mix(in srgb, var(--gold) 45%, #000); box-shadow: 0 3px 0 rgba(0,0,0,.45); }
  .bj-chip + .bj-chip { top: -7px; }
  .bj-acts { display: flex; gap: 8px; margin-left: auto; }
  .bj-btn { background: var(--chip); padding: 10px 14px 9px; font-size: 16px; box-shadow: 0 5px 0 var(--deep); min-width: 88px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; transition: opacity .2s; }
  .bj-btn small { font: 700 11px var(--font-mono); color: var(--dim); }
  .bj-btn:disabled { opacity: .28; }
  @media (max-width: 760px) {
    .bj-score small { letter-spacing: .06em; }   /* «DEALER», «ДИЛЕР» не влезают в 52px с разрядкой */
    .bj-acts { width: 100%; } .bj-btn { flex: 1; min-width: 0; padding: 10px 4px 9px; font-size: 15px; }
  }
`;

let api, root, P, D, shoeEl, leftEl, betEl, btn = {}, rowEls = {};
let phase = 'idle', stake = 0, doubled = false, lastQuote = '', bag = [];

// ---------- шуз ----------
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buildShoe = () => shuffle(Array.from({ length: TOTAL }, (_, i) => ({ r: RANKS[i % 13], s: SUITS[(i / 13 | 0) % 4] })));
let shoe = buildShoe();
const FORCED = (new URLSearchParams(location.search).get('deck') || '').split(',').map(t => {
  const m = t.trim().toUpperCase().match(/^(10|[2-9TJQKA])([SHDC])?$/);
  return m && { r: m[1] === 'T' ? '10' : m[1], s: m[2] ? SUITS['SHDC'.indexOf(m[2])] : SUITS[Math.floor(Math.random() * 4)] };
}).filter(Boolean);
const draw = () => ({ ...(FORCED.length ? FORCED.shift() : shoe.pop()) });

// ---------- очки ----------
const pts = r => r === 'A' ? 1 : +r || 10;
function score(cards, all = true) {
  let low = 0, ace = false;
  for (const c of cards) if (all || c.up) { low += pts(c.r); ace ||= c.r === 'A'; }
  const best = ace && low + 10 <= 21 ? low + 10 : low;
  return { low, best, soft: best !== low && best < 21 };
}
const isBJ = cards => cards.length === 2 && score(cards).best === 21;
const isTen = c => pts(c.r) === 10;

// ---------- звук ----------
const heartbeat = (v = 1) => { tone(70, .13, 'sine', .4 * v, -25); tone(58, .16, 'sine', .32 * v, -20, .2); };
const flipSnd = () => { api.sfx.card(); tone(220, .09, 'triangle', .1, 160); };
const bustSnd = () => { tone(900, .25, 'sawtooth', .06, -700); tone(90, .3, 'square', .08, -40, .05); };
const bjSnd = () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .14, 'square', .07, 0, i * .055));

// ---------- рисование ----------
function cardEl(c) {
  const d = document.createElement('div'), s = c.s + '︎';
  d.className = 'bj-card down ' + (c.s === '♥' || c.s === '♦' ? 'bj-red' : 'bj-black');
  const mid = 'JQK'.includes(c.r) ? `<b class="bj-face">${c.r}<i>${s}</i></b>` : `<b class="bj-pip${c.r === 'A' ? ' ace' : ''}">${s}</b>`;
  const corner = cls => `<span class="bj-c${cls}">${c.r}<i>${s}</i></span>`;
  d.innerHTML = `<div class="bj-in"><div class="bj-front">${corner('')}${mid}${corner(' bj-c2')}</div><div class="bj-back">${api.TK}</div></div>`;
  return d;
}
function hand(cls, who) {
  const row = document.createElement('div'); row.className = 'bj-row ' + cls;
  const sc = document.createElement('div'); sc.className = 'bj-score'; sc.innerHTML = `<small>${who}</small><b></b>`;
  const el = document.createElement('div'); el.className = 'bj-hand';
  row.append(sc, el);
  return { row, sc, b: sc.querySelector('b'), el, cards: [] };
}
function showScore(h) {
  const vis = h.cards.filter(c => c.up), s = score(vis, false), all = vis.length === h.cards.length;
  const text = !vis.length ? '' : all && isBJ(h.cards) ? 'BJ' : s.soft ? `${s.low}/${s.best}` : String(s.best);
  if (h.b.textContent !== text && text) api.pop(h.sc, 1.15);
  h.b.textContent = text;
  h.b.classList.toggle('soft', s.soft);
  h.sc.classList.toggle('bust', s.best > 21);
  h.sc.classList.toggle('top', s.best === 21);
  h.sc.classList.toggle('bj', text === 'BJ');
}
const shakeEl = (el, px = 10) => el.animate([0, -px, px, -px * .7, px * .7, -px * .3, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: 460 });
const gauge = () => { leftEl.style.width = `calc((100% - 12px) * ${shoe.length / TOTAL})`; };

async function give(h, up = true) {
  const c = draw(); c.el = cardEl(c); h.cards.push(c);
  h.el.classList.toggle('many', h.cards.length > 4);
  h.el.append(c.el); gauge();
  const a = shoeEl.getBoundingClientRect(), b = c.el.getBoundingClientRect();
  const z = b.width / c.el.offsetWidth || 1;   // стол может быть уменьшен zoom'ом (fit в core.js): сдвиг — в его единицах
  const dx = (a.left + a.width / 2 - (b.left + b.width / 2)) / z, dy = (a.top + a.height / 2 - (b.top + b.height / 2)) / z;
  api.sfx.card();
  await c.el.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(-25deg) scale(.7)` },
    { transform: 'translate(0, -6px) rotate(3deg) scale(1.04)', offset: .8 },
    { transform: 'none' },
  ], { duration: 290, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished;
  if (up) await flip(h, c);
  return c;
}
async function flip(h, c) {
  c.up = true; c.el.classList.remove('down'); flipSnd();
  await api.sleep(200); showScore(h); await api.sleep(60);
}
// закрытая карта дилера; tense — с паузой и сердцебиением
async function reveal(tense) {
  const c = D.cards[1];
  if (c.up) return;
  if (tense) {
    heartbeat();
    await c.el.animate([
      { transform: 'none' }, { transform: 'translateY(-10px) scale(1.06) rotate(-2deg)', offset: .3 },
      { transform: 'translateY(-10px) scale(1.06) rotate(2deg)', offset: .55 }, { transform: 'translateY(-12px) scale(1.08) rotate(-1deg)', offset: .8 },
      { transform: 'translateY(-10px) scale(1.06)' },
    ], { duration: 760, easing: 'ease-in-out', fill: 'forwards' }).finished;
    heartbeat(.7);
    await api.sleep(240);
  }
  await flip(D, c);
  if (!tense) return;
  const lifted = c.el.getAnimations();
  c.el.animate([{ transform: 'translateY(-10px) scale(1.06)' }, { transform: 'none' }], { duration: 220, easing: 'ease-in' });
  lifted.forEach(a => a.cancel());
  await api.sleep(300);
}
// подглядывание под закрытую карту при тузе/десятке; true — у дилера блэкджек
async function peek() {
  const c = D.cards[1];
  heartbeat(.8);
  await c.el.animate([
    { transform: 'none' }, { transform: 'translateY(-8px) rotateX(28deg)', offset: .4 }, { transform: 'translateY(-8px) rotateX(28deg)', offset: .7 }, { transform: 'none' },
  ], { duration: 900, easing: 'ease-in-out' }).finished;
  return isBJ(D.cards);
}
async function sweep() {
  const cards = [...P.el.children, ...D.el.children];
  await Promise.all(cards.map((el, i) => el.animate([{ transform: 'none', opacity: 1 },
    { transform: `translate(${-120 - i * 10}px, -30px) rotate(-30deg)`, opacity: 0 }], { duration: 260, delay: i * 25, easing: 'ease-in', fill: 'forwards' }).finished));
  for (const h of [P, D]) { h.el.replaceChildren(); h.el.className = 'bj-hand'; h.cards = []; h.b.textContent = ''; h.sc.className = 'bj-score'; }
}
async function reshuffle() {
  shoe = buildShoe();
  for (let i = 0; i < 10; i++) setTimeout(api.sfx.tick, i * 45);
  await shoeEl.animate([0, -8, 8, -6, 6, 0].map(r => ({ transform: `rotate(${r}deg)` })), { duration: 480 }).finished;
  gauge();
}
function setBet(n) {
  betEl.className = 'bj-bet';
  betEl.innerHTML = n ? `<span class="bj-chips">${'<i class="bj-chip"></i>'.repeat(n)}</span><span>${api.money(stake)}</span>` : '';
}
function setActs() {
  const play = phase === 'play';
  btn.hit.disabled = btn.stand.disabled = !play;
  btn.dbl.disabled = !(play && P.cards.length === 2 && api.balance() >= stake);
  btn.dbl.querySelector('small').innerHTML = api.money(stake, '+');
}
function bustQuote() {
  if (!bag.length) { bag = shuffle([...BUST]); if (bag.at(-1) === lastQuote) bag.reverse(); }
  return lastQuote = bag.pop();
}

// ---------- ход ----------
async function deal() {
  const bet = api.stake();
  if (!api.begin(bet)) return;
  phase = 'deal'; stake = bet; doubled = false; setActs();
  Object.values(rowEls).forEach(r => r.classList.remove('lit'));
  setBet(0);
  await sweep();
  if (shoe.length < CUT) await reshuffle();
  setBet(1); api.sfx.chip();
  await give(P); await give(D); await give(P); await give(D, false);

  const pbj = isBJ(P.cards), up = D.cards[0];
  const dbj = (up.r === 'A' || isTen(up)) && await peek();
  if (dbj) {
    await reveal(false);
    D.el.classList.add('gold'); api.shake(10, 300);
    await api.sleep(450);
    return pbj ? end('push', stake, t('bj.vs', { a: 'BJ', b: 'BJ' }), 'push') : end('lose', 0, t('bj.dealerBJ'), null, api.pick(DEALER_BJ));
  }
  if (pbj) {
    await reveal(false);
    await bjShow();
    return end('big', Math.floor(stake * 2.5), 'BLACKJACK', 'bj', null, 'BLACKJACK', `${api.money(stake)} × 2.5 = ${api.money(Math.floor(stake * 2.5))}`);
  }
  phase = 'play'; api.setPrimary(t('bj.stand'), true, { inRound: true }); setActs();
}
async function hit() {
  if (phase !== 'play') return;
  phase = 'deal'; setActs(); flash(btn.hit);
  await give(P);
  const t = score(P.cards).best;
  if (t > 21) return bust();
  if (t === 21) return dealerTurn();
  phase = 'play'; setActs();
}
async function stand() {
  if (phase !== 'play') return;
  flash(btn.stand);
  await dealerTurn();
}
async function dbl() {
  if (phase !== 'play' || P.cards.length !== 2 || api.balance() < stake || !api.raise(stake)) return;
  phase = 'deal'; flash(btn.dbl);
  stake *= 2; doubled = true; setActs(); setBet(2); api.sfx.chip(); setTimeout(api.sfx.chip, 90);
  api.pop(betEl, 1.4);
  await api.sleep(250);
  await give(P);
  if (score(P.cards).best > 21) return bust();
  await dealerTurn();
}
async function bust() {
  phase = 'dealer'; setActs();
  P.el.classList.add('bust'); bustSnd(); shakeEl(P.el, 12); api.shake(10, 320);
  await api.sleep(650);
  await reveal(false);
  await api.sleep(250);
  end('lose', 0, t('bj.bustN', { n: score(P.cards).best }), null, bustQuote());
}
async function dealerTurn() {
  phase = 'dealer'; setActs();
  await reveal(true);
  while (score(D.cards).best < 17) {
    heartbeat(.45);
    await api.sleep(520);
    await give(D, false);
    await api.sleep(160);
    await flip(D, D.cards.at(-1));
    await api.sleep(260);
  }
  const p = score(P.cards).best, d = score(D.cards).best, x2 = doubled ? '×2 · ' : '';
  if (d > 21) {
    D.el.classList.add('bust'); bustSnd(); shakeEl(D.el, 12); api.shake(8, 260);
    await api.sleep(500);
  }
  if (d > 21 || p > d) {
    return end(doubled ? 'big' : 'small', stake * 2, x2 + t('bj.vs', { a: p, b: d > 21 ? t('bj.bustWord') : d }), doubled ? 'dbl' : 'win', null, doubled ? 'DOUBLE' : null,
      `${api.money(stake)} × 2 = ${api.money(stake * 2)}`);
  }
  if (p === d) return end('push', stake, x2 + t('bj.vs', { a: p, b: d }), 'push');
  end('lose', 0, x2 + t('bj.vs', { a: p, b: d }));
}
async function bjShow() {
  P.el.classList.add('gold'); bjSnd();
  P.cards.forEach((c, i) => c.el.animate([{ transform: 'none' }, { transform: `translateY(-26px) rotate(${i ? 9 : -9}deg) scale(1.16)` }, { transform: 'none' }],
    { duration: 420, delay: i * 110, easing: 'cubic-bezier(.3,1.6,.5,1)' }));
  api.burstAt(P.el, 40, 'coin'); api.shake(12, 380);
  await api.sleep(650);
}
async function end(kind, back, label, row = null, quote = null, banner = null, calc = '') {
  phase = 'done'; setActs(); api.setPrimary(t('bj.deal'));
  if (row) rowEls[row].classList.add('lit');
  const win = kind === 'small' || kind === 'big';
  if (win && !P.el.classList.contains('gold')) { P.el.classList.add('win'); P.sc.classList.add('win'); }
  if (kind === 'push') [P, D].forEach(h => { h.el.classList.add('push'); h.sc.classList.add('push'); });
  if (kind === 'lose' && !P.el.classList.contains('bust')) P.el.classList.add('dim');
  if (win && !D.el.classList.contains('bust')) D.el.classList.add('dim');
  betEl.classList.add(win ? 'won' : kind === 'lose' ? 'lost' : 'push');
  if (win) P.cards.forEach((c, i) => setTimeout(() => api.pop(c.el, 1.12), i * 70));
  await api.finish({ back, kind, label, at: P.el, banner, quote, calc: calc || (kind === 'lose' || kind === 'push' ? label : '') });
  phase = 'idle';
}
function flash(b) { b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 90); }

export default {
  id: 'blackjack', title: t('bj.title'), primaryLabel: t('bj.deal'),
  mount(el, rules, a) {
    api = a; phase = 'idle';
    root = document.createElement('div'); root.className = 'bj-table';
    const style = document.createElement('style'); style.textContent = CSS; root.append(style);
    shoeEl = document.createElement('div'); shoeEl.className = 'bj-shoe';
    shoeEl.innerHTML = `<div class="bj-stack">${api.TK}</div><i class="bj-left"></i>`;
    leftEl = shoeEl.querySelector('.bj-left');
    D = hand('bj-dealer', t('bj.dealer')); P = hand('bj-player', t('bj.you'));
    const mid = document.createElement('div'); mid.className = 'bj-mid';
    betEl = document.createElement('div'); betEl.className = 'bj-bet';
    const acts = document.createElement('div'); acts.className = 'bj-acts';
    const mk = (name, text, key, fn) => {
      const b = document.createElement('button'); b.className = 'bj-btn'; b.disabled = true;
      b.innerHTML = `${text}${name === 'dbl' ? '<small></small>' : ''}<kbd>${key}</kbd>`;
      b.onclick = () => { fn(); b.blur(); };
      acts.append(b); btn[name] = b;
    };
    mk('hit', t('bj.hit'), 'H', hit); mk('stand', t('bj.stand'), 'S', stand); mk('dbl', t('bj.double'), 'D', dbl);
    mid.append(betEl, acts);
    root.append(shoeEl, D.row, mid, P.row);
    el.append(root);
    gauge(); setActs();

    rules.innerHTML = `<div class="h">${t('pays')}</div>`;
    rowEls = {};
    const row = (key, s, x, cls = '') => {
      const r = document.createElement('div'); r.className = 'row ' + cls;
      r.innerHTML = `<div class="s">${s}</div><div class="x">${x}</div>`;
      rules.append(r); if (key) rowEls[key] = r;
    };
    row('bj', 'BLACKJACK', '3:2');
    row('win', t('bj.ruleWin'), '1:1');
    row('dbl', t('bj.ruleDouble'), '1:1');
    row('push', t('bj.rulePush'), '±0');
    row(null, t('bj.ruleDealer'), '', 'bj-info');
    rules.querySelector('.bj-info').style.cssText = 'color:var(--dim);font-size:13px';
  },
  unmount() { root?.remove(); phase = 'idle'; },
  primary() { return phase === 'play' ? stand() : phase === 'idle' ? deal() : undefined; },
  // Space/Enter доходят сюда, только когда главная кнопка погашена (во время раздачи)
  keys: { KeyH: hit, KeyS: stand, KeyD: dbl, Space: stand, Enter: stand },
};
