// «Вариант 1» (Balatro-направление): за столом медленно закручивается густая краска — приглушённые тёмная бирюза и красный,
// чтобы стол на её фоне читался. Канвас мелкий, пиксели не сглаживаются (image-rendering в pixel.css).
// Выигрыш: небо теплеет, от стола расходится белое пиксельное кольцо, разлетаются пиксельные звёзды;
// крупный — тёплый перелив (золото → оранжевый → малиновый) и три кольца. Проигрыш — краска гаснет и стынет.
// core.js отсюда не импортировать: у ядра top-level await на загрузку темы — цикл повиснет.

// ~150 «пикселей» по длинной стороне при любом экране: попиксельный расчёт дорогой, на 4K при 1/7 он съедал бы кадр.
export const scale = Math.min(1 / 7, 150 / Math.max(innerWidth, innerHeight, 1));

const PAL = {   // [тёмный, основной A, основной B, прожилки]
  idle:    [[14, 26, 32], [34, 84, 90], [128, 44, 54], [150, 120, 70]],
  playing: [[16, 30, 38], [40, 98, 106], [150, 52, 64], [180, 145, 80]],
  win:     [[70, 34, 16], [214, 136, 36], [190, 78, 44], [255, 226, 150]],
  lose:    [[10, 10, 14], [40, 44, 50], [56, 36, 42], [70, 64, 60]],
};
const BIG = [[232, 168, 40], [222, 100, 48], [190, 60, 100], [214, 136, 36]];   // тёплый перелив крупного выигрыша, без кислоты
const STAR = ['#ffd84a', '#ffffff', '#3cf08f', '#ff8a00', '#ff5a7a'];
let T = 0, lastT = null, img = null, last = null, win = 0, big = 0, dark = 0, odd = false, rings = [], stars = [];
const cur = PAL.idle.map(c => c.slice());

function center(w, h) {
  const r = document.querySelector('.machine')?.getBoundingClientRect();
  return r && r.width ? [(r.left + r.width / 2) * w / innerWidth, (r.top + r.height / 2) * h / innerHeight] : [w / 2, h / 2];
}
function pixStar(ctx, x, y, s, col) {   // пиксельная звезда: крест + центр, обведённый тёмным
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#0c0820';
  ctx.fillRect(x - s - 1, y - 1, s * 2 + 3, 3); ctx.fillRect(x - 1, y - s - 1, 3, s * 2 + 3); ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = col;
  ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1); ctx.fillRect(x - 1, y - 1, 3, 3);
}

export function draw(ctx, w, h, t, hype) {
  const o = document.body.dataset.outcome || '';
  if (last === null) last = o;
  const dt = lastT === null ? 0 : Math.min(.1, t - lastT); lastT = t;
  if (o !== last) {
    const [cx, cy] = center(w, h), isBig = o === 'big' || o === 'jackpot';
    if (o === 'small' || isBig) {
      win = isBig ? 3.5 : 2.2; if (isBig) big = 3.5;
      for (let i = 0; i < (isBig ? 3 : 1); i++) rings.push({ x: cx, y: cy, r: 4 - i * 9, a: 1 });
      for (let i = 0, n = isBig ? 12 : 6; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (isBig ? 45 : 30) + Math.random() * 40;
        stars.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .8, s: 2 + (isBig && Math.random() < .35 ? 1 : 0), col: STAR[i % STAR.length], life: 1 });
      }
    }
    if (o === 'lose') dark = 1;
    last = o;
  }
  win = Math.max(0, win - dt); big = Math.max(0, big - dt); dark *= .975;
  const fx = rings.length || stars.length;
  const speed = .3 + hype * 1.4 + (o === 'playing' ? .4 : 0) + Math.min(1, win) * 1.2 - dark * .25;
  T += dt * Math.max(.05, speed);

  // палитра плавно едет к цели исхода
  let goal = PAL.idle;
  if (o === 'playing') goal = PAL.playing;
  if (win > 0) goal = PAL.win;
  if (dark > .15) goal = PAL.lose;
  if (big > 0) { const k = t * .5, i = Math.floor(k) % 4, j = (i + 1) % 4, f = k % 1;
    const c = BIG[i].map((v, n) => v + (BIG[j][n] - v) * f), d = BIG[(i + 2) % 4];
    goal = [[60, 24, 30], c, d, [255, 240, 190]]; }
  const ease = goal === PAL.idle || goal === PAL.playing ? .04 : .2;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cur[i][j] += (goal[i][j] - cur[i][j]) * ease;
  const [D, A, B, G] = cur;

  // краска течёт медленно — без эффектов хватает 30 кадров в секунду
  if ((odd = !odd) && !fx && img && img.width === w && img.height === h) return;
  if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
  const px = img.data, m = Math.max(w, h), cx = w / 2, cy = h * .45;
  const swirl = 2.4 + hype * 1.2, t1 = T * .9, t2 = T * .7, t3 = T * .5;
  let k = 0;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      let x = (xx - cx) / m * 6, y = (yy - cy) / m * 6;
      const r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x) + swirl / (r + .6) - t3 * .4;
      x = r * Math.cos(a); y = r * Math.sin(a);
      for (let n = 0; n < 4; n++) {   // краска мешается: каждый слой гнёт координаты предыдущего
        x += .55 * Math.sin(y * 1.2 + t1 + n);
        y += .55 * Math.cos(x * 1.1 - t2 + n * 1.7);
      }
      const v = .5 + .5 * Math.sin(x * 1.4 + y * .9);
      const s = v < .46 ? 0 : v > .54 ? 1 : (v - .46) / .08;             // граница A/B — узкая, как мазок
      const g = Math.max(0, Math.sin(y * 1.7 - x * .7 + t3) - .86) * 4;    // редкие прожилки
      const d = Math.abs(v - .5) < .1 ? .75 : Math.abs(v - .5) < .16 ? .3 : 0;   // тёмная кромка ступенькой, как у пиксельной краски
      const vig = Math.max(.35, Math.min(1, 1.15 - r * .2));
      for (let c = 0; c < 3; c++) {
        let val = A[c] + (B[c] - A[c]) * s;
        val += (D[c] - val) * d * .6;
        val += (G[c] - val) * Math.min(.7, g);
        px[k + c] = val * vig * (1 - dark * .45);
      }
      px[k + 3] = 255; k += 4;
    }
  }
  ctx.putImageData(img, 0, 0);

  // кольца-ударные волны от стола (в пикселях канваса — выходят крупными и ступенчатыми)
  ctx.lineWidth = 1.6;
  rings = rings.filter(r => r.a > 0);
  for (const r of rings) {
    r.r += 70 * dt; if (r.r > 0) r.a -= dt * .9;
    if (r.r <= 0) continue;
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, r.a) * .85})`; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  stars = stars.filter(p => p.life > 0);
  for (const p of stars) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy = p.vy * .97 + 12 * dt; p.life -= dt * .55;
    if (p.life > .15 || Math.floor(t * 12) % 2) pixStar(ctx, p.x, p.y, p.s, p.col);   // в конце жизни мигает
  }
}
