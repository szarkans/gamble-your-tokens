// «📸» — итог дня картинкой-полароидом: выезжает, проявляется, сразу лежит в буфере.
import { openModal, closeModal, tone, money, fmt, $ } from './core.js';
import { t as tr, lang } from './i18n.js';

const W = 1080, H = 1300, M = 60, PH = 1000;   // полароид: белая рамка, снизу поле под подпись

const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const hue = name => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

// Холст не знает font-size-adjust, а пиксельный шрифт темы без него в полтора раза крупнее: K — та же подгонка
// (x-высота 0.5 размера), считается в draw(). Всё, что пишется на карточку, меряется и ужимается под своё место.
let K = 1;
// иероглифы и хангыль берутся из системного шрифта — подгонка под пиксельный их бы зря ужала
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const font = (ctx, px, fam, w = '', text = '') => { const k = CJK.test(text) ? Math.max(K, .9) : K; ctx.font = `${w} ${Math.max(8, Math.round(px * k))}px ${fam}`; };
function clip(ctx, text, maxW) {   // не влезло даже ужатое — режем с многоточием
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text; while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
// текст в ширину maxW: сперва уменьшается (не меньше min от размера), потом многоточие; возвращает итоговую ширину
function fitText(ctx, text, x, y, px, fam, maxW, { w = '', min = .55, align = 'left', value = false } = {}) {
  const probe = value ? '' : text;   // значения (цифры с вкраплением иероглифа) — в одном размере с остальными цифрами
  font(ctx, px, fam, w, probe);
  const tw = ctx.measureText(text).width;
  if (tw > maxW) font(ctx, Math.max(px * min, px * maxW / tw), fam, w, probe);
  const s = clip(ctx, text, maxW), sw = ctx.measureText(s).width;
  ctx.save(); ctx.textAlign = 'left'; ctx.fillText(s, align === 'right' ? x - sw : align === 'center' ? x - sw / 2 : x, y); ctx.restore();
  return sw;
}

function tk(ctx, x, y, cap) {   // ₮ высотой с цифру: T с чертой через ножку, как в интерфейсе (путь 16×20 в коробке 2..18 × 2..22)
  const s = cap / 20;
  ctx.save(); ctx.translate(x - 2 * s, y - cap - 2 * s); ctx.scale(s, s);
  ctx.fill(new Path2D('M2 2h16v4h-6v16H8V6H2z M3 11h14v3H3z'));
  ctx.restore();
}
// сумма «±₮1.2M»: ужимается в maxW; dry — только померить
function amount(ctx, x, y, n, px, sign = '', align = 'left', maxW = Infinity, dry = false) {
  const fam = cssVar('--font-display'), text = fmt(n);
  const m = sz => { font(ctx, sz, fam); const cap = ctx.measureText('0').actualBoundingBoxAscent || sz * K * .7, sw = sign ? ctx.measureText(sign).width : 0;
    return { cap, sw, w: sw + cap * 1.1 + ctx.measureText(text).width }; };
  let r = m(px);
  if (r.w > maxW) r = m(px * maxW / r.w);
  if (dry) return r.w;
  ctx.save(); ctx.textAlign = 'left';
  let cx = align === 'center' ? x - r.w / 2 : align === 'right' ? x - r.w : x;
  if (sign) { ctx.fillText(sign, cx, y); cx += r.sw; }
  tk(ctx, cx, y, r.cap); cx += r.cap * 1.1;
  ctx.fillText(text, cx, y);
  ctx.restore();
  return r.w;
}

function draw(S) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const ink = cssVar('--ink'), dim = cssVar('--dim'), gold = cssVar('--gold'), win = cssVar('--win'), lose = cssVar('--lose');
  const disp = cssVar('--font-display'), mono = cssVar('--font-mono');
  const t = S.today || {}, net = Math.floor(S.net), date = new Date().toLocaleDateString(lang);
  ctx.font = `100px ${disp}`; const xh = ctx.measureText('x').actualBoundingBoxAscent; K = xh > 50 ? 50 / xh : 1;

  ctx.fillStyle = '#f7f5ef'; ctx.fillRect(0, 0, W, H);                      // бумага полароида
  const grd = ctx.createLinearGradient(0, M, 0, M + PH);                    // «фото» — в цветах темы
  grd.addColorStop(0, cssVar('--panel')); grd.addColorStop(1, cssVar('--deep'));
  ctx.fillStyle = grd; ctx.fillRect(M, M, W - 2 * M, PH);
  ctx.save(); ctx.beginPath(); ctx.rect(M, M, W - 2 * M, PH); ctx.clip();

  const L = M + 60, R = W - M - 60, BW = R - L;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = dim;
  const dw = fitText(ctx, date, L, M + 90, 34, mono, BW * .4, { w: 600 });
  ctx.fillStyle = gold; fitText(ctx, 'GAMBLE YOUR TOKENS', R, M + 90, 34, disp, BW - dw - 40, { align: 'right' });

  let head, color, value, sign;
  if (!t.rounds) { head = tr('pol.notYet'); color = gold; value = S.earned; sign = ''; }
  else if (net < 0) { head = Math.floor(S.earned + S.net) < 1000 ? tr('pol.lostAll') : tr('pol.lost'); color = lose; value = -net; sign = '−'; }
  else if (net > 0) { head = tr('pol.won'); color = win; value = net; sign = '+'; }
  else { head = tr('pol.even'); color = ink; value = 0; sign = '±'; }
  ctx.fillStyle = dim; fitText(ctx, head, L, M + 250, 64, disp, BW);
  ctx.fillStyle = color; amount(ctx, L, M + 420, value, 170, sign, 'left', BW);

  // строка «подпись … значение»: значение справа целиком (ужимается до 60% ширины), подписи — что осталось
  const line = (y, k, v) => {
    ctx.fillStyle = ink;
    const vw = typeof v === 'number' ? amount(ctx, R, y, v, 44, '', 'right', BW * .6) : fitText(ctx, v, R, y, 44, disp, BW * .6, { align: 'right', value: true });
    ctx.fillStyle = dim; fitText(ctx, k, L, y, 36, mono, BW - vw - 30, { w: 600 });
  };
  line(M + 540, tr('pol.earned'), S.earned);
  line(M + 610, tr('pol.rounds'), `${t.rounds || 0}${t.rounds ? ` · ${tr('pol.wonN', { n: t.won_rounds })}` : ''}`);
  if (t.best) line(M + 680, tr('pol.best'), `+${fmt(t.best.profit)} · ${t.best.label || t.best.game}`);

  // доли харнессов: полоса и легенда, легенда переносится по строкам (до трёх), не вылезая за правый край
  const src = (S.sources || []).filter(x => x.tokens > 0), total = src.reduce((a, x) => a + x.tokens, 0) || 1;
  let x = L; const by = M + 770;
  for (const s of src) { const w = BW * s.tokens / total; ctx.fillStyle = `hsl(${hue(s.name)} 70% 62%)`; ctx.fillRect(x, by, Math.max(4, w - 4), 22); x += w; }
  let lx = L, ly = by + 76;
  for (const s of src.slice(0, 6)) {
    const label = `${s.name} ${Math.round(s.tokens / total * 100)}%`;
    font(ctx, 32, mono, 600, label); const lw = Math.min(BW - 30, ctx.measureText(label).width);
    if (lx > L && lx + 30 + lw > R) { lx = L; ly += 52; }
    if (ly > M + PH - 30) break;
    ctx.fillStyle = `hsl(${hue(s.name)} 70% 62%)`; ctx.beginPath(); ctx.arc(lx + 10, ly - 11, 10, 0, 7); ctx.fill();
    ctx.fillStyle = dim; fitText(ctx, label, lx + 30, ly, 32, mono, BW - 30, { w: 600 });
    lx += 30 + lw + 40;
  }
  ctx.restore();

  ctx.fillStyle = '#2b2a28'; ctx.font = `52px "Segoe Print", "Comic Sans MS", "Bradley Hand", cursive`; ctx.textAlign = 'center';
  ctx.fillText(clip(ctx, tr('pol.caption'), W - 2 * M), W / 2, M + PH + 130); ctx.textAlign = 'left';
  return c;
}

const CSS = `
  .pol-wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; perspective: 900px; }
  .pol { width: min(380px, 78vw); aspect-ratio: ${W} / ${H}; position: relative; box-shadow: 0 30px 60px rgba(0,0,0,.55); border-radius: 4px; overflow: hidden; }
  .pol img { width: 100%; height: 100%; display: block; }
  .pol .dev { position: absolute; left: ${M / W * 100}%; top: ${M / H * 100}%; width: ${(W - 2 * M) / W * 100}%; height: ${PH / H * 100}%;
    background: #1d1a17; pointer-events: none; }
  .pol-actions { display: flex; gap: 10px; }
  .pol-actions button { background: var(--chip); padding: 10px 18px; font-size: 16px; box-shadow: 0 5px 0 var(--deep); }
  .pol-actions button.on { background: var(--win); color: var(--deep); }
`;

function shutter() {
  // щелчок затвора + жужжание выезда, синтезом
  for (let i = 0; i < 5; i++) tone(3000 + Math.random() * 3000, .02, 'square', .05, 0, i * .012);
  tone(90, .9, 'sawtooth', .05, 40, .1); tone(180, .9, 'square', .015, 60, .1);
}

export async function openShare(S) {
  if (!S.loaded || S.busy) return;   // посреди хода ставка уже списана, итог ещё неизвестен
  const canvas = draw(S);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const wrap = document.createElement('div'); wrap.className = 'pol-wrap';
  wrap.innerHTML = `<style>${CSS}</style><div class="pol"><img alt="${tr('share')}"><div class="dev"></div></div>
    <div class="pol-actions"><button data-a="copy">${tr('pol.copy')}</button><button data-a="save">${tr('pol.save')}</button><button data-a="close">✕</button></div>`;
  wrap.querySelector('img').src = url;
  openModal(wrap);
  const pol = wrap.querySelector('.pol'), dev = wrap.querySelector('.dev'), copyBtn = wrap.querySelector('[data-a="copy"]');

  shutter();
  pol.animate([   // выезжает из «камеры» сверху, с лёгким разворотом
    { transform: 'translateY(-115vh) rotate(-8deg)' },
    { transform: 'translateY(12px) rotate(3deg)', offset: .7 },
    { transform: 'translateY(0) rotate(-2deg)' },
  ], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  dev.animate([   // проявка: от тёмной плёнки к снимку
    { opacity: 1, filter: 'sepia(1)' },
    { opacity: .85, offset: .3 },
    { opacity: 0 },
  ], { duration: 2600, delay: 700, easing: 'ease-in', fill: 'forwards' });

  const copy = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); copyBtn.textContent = tr('pol.copied'); copyBtn.classList.add('on'); tone(1320, .08, 'triangle', .08); }
    catch { copyBtn.textContent = tr('pol.noClip'); }
  };
  copy();
  wrap.querySelector('[data-a="copy"]').onclick = copy;
  wrap.querySelector('[data-a="save"]').onclick = () => {
    const a = document.createElement('a'); a.href = url; a.download = `gamble-your-tokens-${S.date || 'today'}.png`; a.click();
  };
  wrap.querySelector('[data-a="close"]').onclick = () => { URL.revokeObjectURL(url); closeModal(); };
}
