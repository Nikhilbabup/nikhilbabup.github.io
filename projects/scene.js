/* Pixel-art banner scenes for the project pages.
   Each page has <canvas id="scene" data-scene="…">; the bunny from the home page stars in all of them. */
(() => {
const cv = document.getElementById('scene');
if (!cv) return;

/* ---------- Palette & helpers (same as the home page) ---------- */
const C = {
  cloud: '#f6f3ea', cloudShade: '#e3e9e1', cloudHi: '#ffffff',
  leafHi: '#cfe3c9', leafL: '#a9c9ad', leafM: '#7fa98e', leafD: '#557f6c', leafO: '#3f6656',
  trunk: '#7a4c40', trunkL: '#9b6b5c',
  grass: '#6f9f86', grassD: '#4e7f6b',
  dirtL: '#c4a28f', dirt: '#a8786a', dirtD: '#6e443a',
  red: '#e0645a', redD: '#b84a42', pink: '#eaa5a0', white: '#f7f3ec', ink: '#2f3e3a',
  grey: '#9aa09b', greyL: '#c9cfca', greyD: '#6b716c', line: '#56635f', gold: '#e8b04a', sky: '#8fb8b0',
  green: '#6fbf73', greenD: '#4f9a55', wall: '#efe6d6', wallD: '#e0d3bd', board: '#2f5a4f', chalk: '#e8efe9',
  night: '#24354a', panel: '#34506b', panelL: '#9fc1d8', glow: '#f6e7b8'
};
const W = 320, H = 120, GROUND = 108;

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
function line(g, x0, y0, x1, y1, c) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    px(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
const clamp01 = u => Math.min(Math.max(u, 0), 1);
const lerp = (a, b, u) => a + (b - a) * clamp01(u);
const ease = u => (u = clamp01(u), u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const phase = (p, a, b) => (p - a) / (b - a);
const hop = (u, n, h) => -Math.round(Math.abs(Math.sin(clamp01(u) * Math.PI * n)) * h);

function makeCloud(w, h, circles) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const inside = (x, y) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    px(g, x, y, !inside(x, y + 3) ? C.cloudShade : !inside(x, y - 2) ? C.cloudHi : C.cloud);
  }
  return c;
}

function pine(g, r, cx, base, h) {
  const trunkH = 7;
  for (let y = base - trunkH; y < base; y++) {
    px(g, cx - 1, y, C.trunkL); px(g, cx, y, C.trunk); px(g, cx + 1, y, C.trunk);
  }
  const top = base - trunkH - h + 3, tiers = 4, tl = h / tiers, maxHW = h * 0.27;
  for (let i = 0; i < h; i++) {
    const y = top + i, ti = Math.floor(i / tl), within = i - ti * tl;
    const hw = Math.round((i / h) * maxHW * 0.55 + (within / tl) * maxHW * 0.45) + 1;
    for (let dx = -hw; dx <= hw; dx++) {
      const edge = Math.abs(dx) === hw;
      if (edge && r() < 0.35) continue;
      const v = dx / hw + (r() - 0.5) * 0.6;
      let col = v < -0.45 ? C.leafL : v > 0.35 ? C.leafD : C.leafM;
      if (within > tl - 1.6) col = r() < 0.7 ? C.leafD : C.leafO;
      if (edge && r() < 0.5) col = C.leafO;
      if (r() < 0.04) col = C.leafHi;
      px(g, cx + dx, y, col);
    }
  }
}

/* ---------- Sprites ---------- */
function sprite(g, s, x, y, { flip = false, outline = null, pal = null } = {}) {
  const P = pal ? { ...s.pal, ...pal } : s.pal, w = Math.max(...s.rows.map(r => r.length));
  const at = (i, j) => P[(s.rows[j] || '')[i]];
  const put = (i, j, c) => px(g, x + (flip ? w - 1 - i : i), y + j, c);
  if (outline) s.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!at(i, j)) return;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => { if (!at(i + ox, j + oy)) put(i + ox, j + oy, outline); });
  }));
  s.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (at(i, j)) put(i, j, at(i, j)); }));
}

const BUNNY = { pal: { w: C.white, p: C.pink, k: C.ink, r: C.red, s: '#d8d2c6' }, rows: [
  '.w.w...', '.w.w...', '.p.p...', '.wwww..', 'wwwwws.', 'wkwwws.', 'wwwpws.',
  '.wwws..', 'rrrrrw.', 'rrrrr..', 'rrrrs..', '.w.w...'] };
// x = left edge, foot = y of the feet row. Faces left by default.
function bunny(g, x, foot, { flip = false, eyes = 'open', t = 0 } = {}) {
  const closed = eyes === 'closed' || (eyes === 'open' && t % 3400 < 140);
  sprite(g, BUNNY, Math.round(x), Math.round(foot) - 11, { flip, outline: '#8c7f78', pal: closed ? { k: '#8c7f78' } : null });
}

const HEN = { pal: { w: C.white, r: C.red, y: C.gold, k: C.ink, s: '#d8d2c6' }, rows: [
  '.rr......', 'kwwk...kk', 'ywkwk.kwk', '.kwwkkwwk', '.kwwwwwwk', '..kwwswk.', '...kkkk..', '...y..y..'] };
const HEN_PECK = { pal: HEN.pal, rows: [
  '.........', '.......kk', '......kwk', '..kkkkwwk', '.kwwwwwwk', 'rkwwwswk.', 'ywkkkkk..', '...y..y..'] };
const CHICK = { pal: { y: '#f2c94c', o: C.gold, k: C.ink }, rows: ['.yy.', 'ykyo', 'yyy.', '.o..'] };

/* ---------- Tiny pixel font ---------- */
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '=': ['000', '111', '000', '111', '000'],
  x: ['000', '101', '010', '101', '000'], ':': ['0', '1', '0', '1', '0'], '?': ['111', '001', '011', '000', '010'],
  '!': ['1', '1', '1', '0', '1'], z: ['111', '001', '010', '100', '111'], ' ': ['00', '00', '00', '00', '00'],
  '-': ['000', '000', '111', '000', '000'], E: ['111', '100', '110', '100', '111'], N: ['101', '111', '111', '101', '101'], A: ['010', '101', '111', '101', '101'], R: ['110', '101', '110', '101', '101'],
  'v': ['00001', '00010', '10100', '01000', '00000']
};
function text(g, s, x, y, c, upto = Infinity) {
  [...s].forEach((ch, n) => {
    const gl = FONT[ch];
    if (n < upto) gl.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(g, x + i, y + j, c); }));
    x += gl[0].length + 1;
  });
}
const textWidth = s => [...s].reduce((w, ch) => w + FONT[ch][0].length + 1, -1);

/* ---------- Scenes ---------- */
const SCENES = {

  /* Bunny collects a freshly laid egg; the counter on the board ticks up. */
  'poultry-farm': {
    cycle: 10000, still: 6000,
    trees: [[296, 46], [312, 36]], flowers: [10, 150, 214, 270],
    build(g) {
      // fence behind the yard
      for (let x = 96; x < W; x++) { px(g, x, 95, C.trunkL); px(g, x, 96, C.trunk); px(g, x, 101, C.trunkL); px(g, x, 102, C.trunk); }
      for (let x = 98; x < W; x += 14) { rect(g, x, 92, 2, GROUND - 92, C.trunkL); rect(g, x + 2, 92, 1, GROUND - 92, C.trunk); rect(g, x, 91, 3, 1, C.dirtD); }
      // coop walls with planks
      for (let y = 80; y < GROUND; y++) for (let x = 20; x <= 56; x++)
        px(g, x, y, x === 20 || x === 56 ? C.dirtD : (x - 20) % 6 === 0 ? C.trunk : C.trunkL);
      // roof
      for (let y = 64; y <= 80; y++) {
        const hw = Math.round((y - 64) * 1.5);
        for (let x = 38 - hw; x <= 38 + hw; x++) px(g, x, y, y === 80 || Math.abs(x - 38) >= hw - 1 ? C.redD : y % 3 === 0 ? '#d4574e' : C.red);
      }
      // door, windows, straw
      rect(g, 33, 90, 11, GROUND - 90, '#4a3530'); rect(g, 35, 89, 7, 1, '#4a3530'); rect(g, 33, GROUND - 2, 11, 2, C.gold);
      [[24, 84], [46, 84]].forEach(([x, y]) => { rect(g, x, y, 6, 5, C.ink); rect(g, x + 1, y + 1, 4, 3, C.gold); rect(g, x + 3, y, 1, 5, C.ink); });
      // egg counter board
      rect(g, 70, 88, 2, GROUND - 88, C.trunk);
      rect(g, 60, 76, 22, 13, C.dirtD); rect(g, 61, 77, 20, 11, '#f4f1e8');
      // feed sack
      rect(g, 86, 99, 8, 9, '#a8936c'); rect(g, 87, 100, 6, 8, '#d9c7a3'); rect(g, 89, 98, 2, 1, '#a8936c');
      rect(g, 88, 103, 4, 2, C.red);
    },
    draw(g, t, p, n, o = {}) {
      // when the runner bunny dashes past (o.runnerX, in farm pixels), birds hop, flap and turn away
      const dodge = x => {
        if (o.runnerX == null) return null;
        const d = x + 4 - (o.runnerX + 3);
        if (Math.abs(d) > 18) return null;
        return { dx: Math.sign(d || 1) * (18 - Math.abs(d)) * 0.6, dy: -2 - (Math.floor(t / 80) % 2) * 2, away: d > 0 };
      };
      const flap = (x, y) => { if (Math.floor(t / 80) % 2) { px(g, x - 1, y + 2, C.white); px(g, x + 9, y + 2, C.white); } };
      const laid = p >= 3000 && p < 5200, picked = p >= 5200;
      const count = String(146 + n + (picked ? 1 : 0)).padStart(3, '0');
      // egg icon + count on the board
      sprite(g, { pal: { e: C.gold, s: '#c98b2e' }, rows: ['.e.', 'eee', 'ees', '.s.'] }, 63, 80);
      text(g, count, 68, 80, picked && p < 6200 && Math.floor(p / 150) % 2 ? C.red : C.ink);

      // wandering hens (+ chicks following the first one)
      [[184, 0], [238, 1], [282, 2]].forEach(([bx, i]) => {
        const k = t / (2600 + i * 500) + i * 2, x = bx + 14 * Math.sin(k), moving = Math.abs(Math.cos(k)) > 0.35;
        const peck = !moving && Math.floor(t / 260 + i) % 3 === 0, f = dodge(x);
        if (f) { sprite(g, HEN, Math.round(x + f.dx), GROUND - 8 + f.dy, { flip: f.away }); flap(Math.round(x + f.dx), GROUND - 8 + f.dy); }
        else sprite(g, peck ? HEN_PECK : HEN, Math.round(x), GROUND - 8, { flip: Math.cos(k) > 0 });
        if (i === 0) [0, 1].forEach(j => {
          const cx = x + (Math.cos(k) > 0 ? -9 - 6 * j : 11 + 6 * j), fc = dodge(cx - 2);
          if (fc) sprite(g, CHICK, Math.round(cx + fc.dx), GROUND - 6 + fc.dy, { flip: !fc.away });
          else sprite(g, CHICK, Math.round(cx), GROUND - 4 - (Math.floor(t / 220 + j) % 2), { flip: Math.cos(k) < 0 });
        });
      });

      // the laying hen
      let hx, hflip = false, sit = false;
      if (p < 1500) hx = lerp(126, 122, phase(p, 1100, 1500)) + (p < 1100 ? Math.round(2 * Math.sin(t / 300)) : 0);
      else if (p < 3000) { hx = 122; sit = true; }
      else if (p < 4200) { hx = lerp(122, 146, ease(phase(p, 3000, 4200))); hflip = true; }
      else if (p < 8800) hx = 146 + Math.round(4 * Math.sin(t / 500));
      else hx = lerp(146, 126, ease(phase(p, 8800, 10000)));
      const fl = dodge(hx);
      if (fl) { sprite(g, HEN, Math.round(hx + fl.dx), GROUND - 8 + fl.dy, { flip: fl.away }); flap(Math.round(hx + fl.dx), GROUND - 8 + fl.dy); }
      else if (sit) {
        sprite(g, { pal: HEN.pal, rows: HEN.rows.slice(0, 7) }, hx, GROUND - 6);
        if (p > 2300 && Math.floor(p / 200) % 2) px(g, hx + 4, GROUND - 9, C.red);   // little effort blink
      } else {
        const peck = p >= 4200 && p < 8800 && Math.floor(t / 300) % 3 === 0;
        sprite(g, peck ? HEN_PECK : HEN, Math.round(hx), GROUND - 8, { flip: hflip });
      }
      if (laid) sprite(g, { pal: { w: '#fbf7ee', s: '#e3d8c3' }, rows: ['.w.', 'www', 'wws', '.s.'] }, 124, GROUND - 4, { outline: '#bfae94' });

      // bunny goes to fetch the egg
      let bx = 100, by = GROUND - 1, flip = true;
      if (p >= 4000 && p < 5000) { const u = phase(p, 4000, 5000); bx = lerp(100, 114, u); by += hop(u, 3, 3); }
      else if (p >= 5000 && p < 5400) { bx = 114; by += 1; }
      else if (p >= 5400 && p < 6400) { const u = phase(p, 5400, 6400); bx = lerp(114, 100, u); by += hop(u, 3, 3); flip = false; }
      this.lastBunny = { x: Math.round(bx), foot: Math.round(by), flip };
      if (!o.hideBunny) {
        bunny(g, bx, by, { flip, t });
        if (p >= 5400 && p < 6400) sprite(g, { pal: { w: '#fbf7ee' }, rows: ['.w.', 'www', 'www'] }, Math.round(bx) - 2, by - 5);
      }
      if (p >= 5200 && p < 6600) { const u = phase(p, 5200, 6600); text(g, '+1', Math.round(lerp(116, 100, u)), Math.round(by - 18 - u * 8), C.gold); }
    }
  },

  /* A day at the desk: the Timez timer runs by day, pauses while the machine sleeps at night. */
  timez: {
    cycle: 12000, still: 3000,
    trees: [[18, 46], [40, 36], [62, 52], [262, 44], [286, 56], [308, 40]], flowers: [80, 236],
    build(g) {
      // cabin walls
      for (let y = 62; y < GROUND; y++) for (let x = 96; x <= 224; x++)
        px(g, x, y, x === 96 || x === 224 ? C.dirtD : y % 6 === 0 ? C.wallD : C.wall);
      // roof
      for (let y = 46; y <= 62; y++) {
        const hw = Math.round((y - 46) * 4.6);
        for (let x = 160 - hw; x <= 160 + hw; x++) px(g, x, y, y === 62 || Math.abs(x - 160) >= hw - 1 ? C.redD : y % 3 === 0 ? '#d4574e' : C.red);
      }
      rect(g, 97, GROUND - 4, 127, 4, C.trunkL); rect(g, 97, GROUND - 4, 127, 1, C.trunk);   // floor
      // clock
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        const d = x * x + y * y;
        if (d <= 36) px(g, 148 + x, 74 + y, d > 25 ? C.ink : C.white);
      }
      [[0, -4], [4, 0], [0, 4], [-4, 0]].forEach(([x, y]) => px(g, 148 + x, 74 + y, C.greyD));
      // desk, monitor, stool
      rect(g, 164, 92, 44, 2, C.trunk); rect(g, 166, 94, 2, 10, C.trunk); rect(g, 204, 94, 2, 10, C.trunk);
      rect(g, 173, 75, 24, 15, C.ink); rect(g, 184, 90, 3, 2, C.ink); rect(g, 180, 91, 11, 1, C.greyD);
      rect(g, 208, 97, 9, 2, C.trunkL); rect(g, 209, 99, 1, 5, C.trunk); rect(g, 215, 99, 1, 5, C.trunk);
      // plant and lamp cord
      rect(g, 102, 98, 6, 6, C.redD); [[103, 95], [105, 93], [107, 95], [104, 96], [106, 96]].forEach(([x, y]) => rect(g, x, y, 1, 3, C.leafD));
      rect(g, 186, 63, 1, 5, C.line);
    },
    draw(g, t, p, n) {
      const night = p >= 6600 && p < 10600, dusk = (p >= 6000 && p < 6600) || (p >= 10600 && p < 11200);
      // window sky
      rect(g, 108, 69, 27, 21, C.trunk);
      rect(g, 109, 70, 25, 19, night ? C.night : dusk ? '#e9a47e' : '#bfe0d8');
      if (night) {
        rect(g, 126, 72, 4, 4, C.white); rect(g, 125, 73, 1, 2, C.white); rect(g, 128, 72, 2, 2, C.night);   // moon
        [[112, 73], [118, 76], [114, 82], [122, 80], [130, 84]].forEach(([x, y], i) => { if (Math.floor(t / 400 + i) % 3) px(g, x, y, C.glow); });
      } else {
        const u = (p < 6600 ? p : p - 12000) / 6600 + 0.1, sx = Math.round(lerp(111, 131, u)), sy = Math.round(86 - Math.sin(clamp01(u) * Math.PI) * 12);
        rect(g, sx - 1, sy - 1, 3, 3, C.gold);
        [[115, 75, 8], [120, 79, 6]].forEach(([x, y, w]) => rect(g, x + ((t / 900) | 0) % 6, y, w, 2, C.white));
      }
      rect(g, 121, 70, 1, 19, C.trunk); rect(g, 109, 79, 25, 1, C.trunk);
      rect(g, 107, 69, 3, 12, C.pink); rect(g, 133, 69, 3, 12, C.pink);           // curtains

      // clock hands keep moving with real time
      const m = t / 1200, h = t / 14400;
      line(g, 148, 74, 148 + Math.round(Math.sin(m) * 4), 74 - Math.round(Math.cos(m) * 4), C.ink);
      line(g, 148, 74, 148 + Math.round(Math.sin(h) * 3), 74 - Math.round(Math.cos(h) * 3), C.red);

      // tracked time only accumulates while awake
      const awakeMs = p < 6600 ? p : p < 10600 ? 6600 : 6600 + p - 10600;
      const mins = 9 * 60 + 12 + Math.floor(awakeMs / 160) + n * 87;
      const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
      if (night) {
        rect(g, 174, 76, 22, 13, '#1f2b30');
        rect(g, 182, 79, 2, 7, C.greyD); rect(g, 186, 79, 2, 7, C.greyD);          // paused
      } else {
        rect(g, 174, 76, 22, 13, C.white); rect(g, 174, 76, 22, 2, C.sky);
        text(g, hh + ':' + mm, 176, 79, C.ink);
        rect(g, 176, 86, 18, 1, C.greyL); rect(g, 176, 86, Math.round(18 * ((awakeMs / 9000) % 1)), 1, C.green);
        if (Math.floor(t / 500) % 2) px(g, 193, 77, C.green);                       // tray "recording" dot
      }

      // lamp
      rect(g, 183, 68, 7, 2, C.gold); rect(g, 184, 67, 5, 1, C.redD);
      if (night || dusk) for (let y = 71; y < 92; y++) for (let x = 186 - (y - 70) / 2; x < 187 + (y - 70) / 2; x++)
        if ((x + y) % 3 === 0 && !(x >= 173 && x < 197 && y >= 75 && y < 90)) px(g, x, y, C.glow);

      // bunny: typing by day, dozing at night
      const asleep = night;
      bunny(g, 208, 96 + (asleep ? 1 : 0), { eyes: asleep ? 'closed' : 'open', t });
      if (!asleep) px(g, 206 - (Math.floor(t / 180) % 2), 91, C.white);
      else for (let i = 0; i < 3; i++) {
        const u = ((p - 6600) / 1300 + i / 3) % 1;
        text(g, 'z', 214 + Math.round(u * 8), Math.round(84 - u * 18), u < 0.85 ? C.line : C.greyL);
      }
      if (p >= 10600 && p < 11400 && Math.floor(p / 200) % 2) text(g, '!', 211, 78, C.red);
    }
  },

  /* Tutor solves on the chalkboard, the student gets it, a session gets booked. */
  'logos-learning': {
    cycle: 11000, still: 7600,
    trees: [[14, 42], [264, 52], [286, 40], [308, 48]], flowers: [36, 150, 248],
    build(g) {
      // easel + board
      line(g, 52, 96, 46, GROUND - 1, C.trunk); line(g, 104, 96, 110, GROUND - 1, C.trunk); line(g, 78, 96, 78, GROUND - 1, C.trunkL);
      rect(g, 42, 62, 72, 36, C.trunk); rect(g, 44, 64, 68, 32, C.board);
      rect(g, 44, 97, 68, 2, C.trunkL); rect(g, 94, 96, 5, 1, C.white);
      // student table, laptop, stool
      rect(g, 196, 96, 34, 2, C.trunk); rect(g, 198, 98, 2, GROUND - 98, C.trunk); rect(g, 226, 98, 2, GROUND - 98, C.trunk);
      rect(g, 202, 94, 20, 2, C.greyD); rect(g, 204, 80, 16, 14, C.ink);
      rect(g, 234, 99, 9, 2, C.trunkL); rect(g, 235, 101, 1, GROUND - 101, C.trunk); rect(g, 241, 101, 1, GROUND - 101, C.trunk);
      // books
      rect(g, 168, 100, 10, 3, C.red); rect(g, 169, 97, 9, 3, C.sky); rect(g, 168, 94, 10, 3, C.gold);
    },
    draw(g, t, p) {
      const L1 = '3x+1=7', L2 = 'x=2', x1 = 50, y1 = 70, x2 = 50, y2 = 82;
      const c1 = Math.floor(clamp01(phase(p, 600, 3600)) * L1.length + (p >= 600 ? 1 : 0)), c2 = Math.floor(clamp01(phase(p, 4000, 5200)) * L2.length + (p >= 4000 ? 1 : 0));
      const wipe = p >= 9600 ? Math.round(lerp(44, 112, phase(p, 9600, 10800))) : 0;
      text(g, L1, x1, y1, C.chalk, Math.min(c1, L1.length));
      text(g, L2, x2, y2, C.chalk, Math.min(c2, L2.length));
      if (p >= 5400) text(g, 'v', x2 + textWidth(L2) + 4, y2, C.green);
      if (p >= 5600 && p < 9600) rect(g, x2 - 2, y2 + 6, textWidth(L2) + 4, 1, C.gold);   // underline the answer
      if (wipe) { rect(g, 44, 64, wipe - 44, 32, C.board); rect(g, wipe - 4, 66, 4, 6, '#c4a28f'); }

      // the cursor the tutor's pointer follows
      let tx, ty;
      if (p < 4000) { const i = Math.min(c1, L1.length); tx = x1 + textWidth(L1.slice(0, i)); ty = y1 + 4; }
      else if (p < 5400) { const i = Math.min(c2, L2.length); tx = x2 + textWidth(L2.slice(0, i)); ty = y2 + 4; }
      else { tx = x2 + textWidth(L2) + 6; ty = y2 + 3; }
      const bx = 120 + Math.round(Math.sin(t / 900) * 2) * (p < 5400 ? 1 : 0);
      bunny(g, bx, GROUND - 1, { t });
      line(g, bx - 1, GROUND - 5, Math.min(tx, 111), ty, C.trunkL);
      if (p < 5400 && Math.floor(t / 150) % 2) px(g, Math.min(tx, 111), ty, C.white);

      // laptop: live video session
      rect(g, 205, 81, 14, 12, '#3d5a52');
      sprite(g, { pal: BUNNY.pal, rows: BUNNY.rows.slice(0, 8) }, 209, 83, { pal: t % 3000 < 140 ? { k: '#d8d2c6' } : null });
      if (Math.floor(t / 500) % 2) px(g, 217, 82, C.red);

      // student: puzzled, then lightbulb
      bunny(g, 236, 98, { t });
      if (p >= 3600 && p < 5600) text(g, '?', 238, 80, C.line);
      if (p >= 5600 && p < 9000) {
        const big = p >= 5800;
        rect(g, 238, big ? 76 : 79, 5, big ? 5 : 3, C.gold); rect(g, 239, 81, 3, 2, C.greyD);
        if (big && Math.floor(p / 220) % 2) [[235, 75], [245, 75], [240, 72], [236, 79], [244, 79]].forEach(([x, y]) => px(g, x, y, C.gold));
      }
      // booking chip pops above the laptop
      if (p >= 6600 && p < 9600) {
        const y = Math.round(lerp(74, 64, ease(phase(p, 6600, 7100))));
        rect(g, 206, y, 13, 11, C.ink); rect(g, 207, y + 1, 11, 9, C.white); rect(g, 207, y + 1, 11, 3, C.red);
        px(g, 209, y, C.ink); px(g, 215, y, C.ink);
        if (p >= 7300) text(g, 'v', 210, y + 5, C.greenD);
      }
    }
  },

  /* Sun charges the panels, energy flows to the battery, the owner gets an SMS. */
  'trinity-solar': {
    cycle: 12000, still: 6400,
    trees: [[14, 40], [34, 52], [304, 44]], flowers: [70, 120, 290],
    build(g) {
      // house
      for (let y = 80; y < GROUND; y++) for (let x = 180; x <= 236; x++) px(g, x, y, x === 180 || x === 236 ? C.dirtD : y % 6 === 0 ? C.wallD : C.wall);
      for (let y = 62; y <= 80; y++) {
        const hw = Math.round((y - 62) * 1.75 + 2);
        for (let x = 208 - hw; x <= 208 + hw; x++) px(g, x, y, y === 80 || Math.abs(x - 208) >= hw - 1 ? C.redD : C.red);
      }
      // solar panels on the left slope
      for (let y = 66; y <= 78; y++) {
        const hw = Math.round((y - 62) * 1.75 + 2);
        for (let x = 208 - hw + 2; x <= 205; x++) px(g, x, y, (y - 66) % 4 === 3 || (x - 180) % 5 === 0 ? C.panelL : C.panel);
      }
      rect(g, 214, 92, 9, GROUND - 92, '#4a3530'); px(g, 221, 100, C.gold);         // door
      // conduit + battery
      line(g, 236, 80, 244, 80, C.line); line(g, 244, 80, 244, 96, C.line); line(g, 244, 96, 252, 96, C.line);
      rect(g, 252, 86, 12, GROUND - 86, C.ink); rect(g, 256, 84, 4, 2, C.ink); rect(g, 254, 88, 8, GROUND - 90, '#1f2b30');
      // fence
      for (let x = 82; x < 172; x += 6) rect(g, x, 100, 2, GROUND - 100, C.white);
      rect(g, 80, 102, 92, 1, C.white);
    },
    sky(g, t, p) {
      const day = p < 8000, u = p / 8000;
      // sun by day, moon at night
      if (day) {
        const sx = Math.round(lerp(24, 296, u)), sy = Math.round(84 - Math.sin(u * Math.PI) * 38);
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) px(g, sx + x, sy + y, x * x + y * y > 6 ? '#f2c46b' : C.gold);
        if (Math.floor(t / 300) % 2) [[0, -6], [0, 6], [-6, 0], [6, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([x, y]) => px(g, sx + x, sy + y, C.gold));
      } else {
        const v = (p - 8000) / 4000, mx = Math.round(lerp(40, 280, v)), my = Math.round(80 - Math.sin(v * Math.PI) * 30);
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = x * x + y * y; if (d <= 10) px(g, mx + x, my + y, d > 6 ? '#b9b39f' : '#fff6d8'); }
        g.clearRect(mx + 1, my - 4, 3, 6);   // crescent (sky layer, so this only cuts the moon)
        [[60, 52], [110, 46], [150, 60], [250, 48], [290, 58], [200, 42]].forEach(([x, y], i) => {
          if (Math.floor(t / 350 + i) % 3) { px(g, x, y, C.gold); if (i % 2) { px(g, x - 1, y, '#f2c46b'); px(g, x + 1, y, '#f2c46b'); px(g, x, y - 1, '#f2c46b'); px(g, x, y + 1, '#f2c46b'); } }
        });
      }
    },
    draw(g, t, p) {
      const day = p < 8000, u = p / 8000;
      // panel glint while sunny
      if (day && u > 0.1 && u < 0.9) { const gx = 186 + Math.floor(t / 120) % 20; for (let y = 67; y <= 77; y += 1) px(g, gx - (y - 67) / 2, y, C.panelL); }

      // battery level: charges by day, powers the house at night
      const lvl = day ? lerp(0.2, 1, phase(p, 800, 6200)) : lerp(1, 0.2, phase(p, 8000, 12000));
      const fill = Math.round(lvl * 16);
      rect(g, 254, GROUND - 2 - fill, 8, fill, lvl > 0.95 ? C.green : lvl > 0.4 ? C.greenD : C.gold);
      // energy particles on the conduit
      const path = [[236, 80], [244, 80], [244, 96], [252, 96]], len = 8 + 16 + 8;
      const flowing = day ? p > 800 && p < 6200 : true;
      if (flowing) for (let i = 0; i < 3; i++) {
        let d = ((t / 40 + i * 11) % len); if (!day) d = len - d;
        let k = 0; while (k < path.length - 2 && d > Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1])) { d -= Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); k++; }
        const [ax, ay] = path[k], [cx, cy] = path[k + 1], s = d / Math.hypot(cx - ax, cy - ay);
        px(g, Math.round(lerp(ax, cx, s)), Math.round(lerp(ay, cy, s)), C.gold);
      }
      // windows light up at night
      rect(g, 186, 86, 9, 8, C.ink); rect(g, 187, 87, 7, 6, day ? '#bfe0d8' : C.glow); rect(g, 190, 87, 1, 6, C.ink);
      if (!day) for (let y = 94; y < 100; y++) for (let x = 185; x < 197; x++) if ((x + y) % 3 === 0) px(g, x, y, C.glow);

      // bunny with phone; SMS when the battery is full, and again when the lights come on
      const bx = 140 + Math.round(Math.sin(t / 1800) * 3), sms = (p >= 6200 && p < 7800) || (p >= 8400 && p < 9800);
      bunny(g, bx, GROUND - 1 + (sms && p % 1600 < 300 ? hop(phase(p % 1600, 0, 300), 1, 2) : 0), { flip: true, t });
      rect(g, bx + 7, 98, 2, 3, C.ink); px(g, bx + 7, 98, sms ? C.green : C.sky);
      if (sms) {
        const shake = Math.floor(t / 90) % 2;
        rect(g, bx + 4 + shake, 80, 15, 10, C.ink); rect(g, bx + 5 + shake, 81, 13, 8, C.white); px(g, bx + 6 + shake, 90, C.ink); px(g, bx + 6 + shake, 91, C.ink);
        if (p < 7800) text(g, 'v', bx + 9 + shake, 83, C.greenD);
        else [0, 1, 2].forEach(i => { if (Math.floor(t / 200) % 3 >= i) rect(g, bx + 7 + shake + i * 4, 85, 2, 2, C.gold); });
      }
    }
  },

  /* Data feeds the reporting board; a report goes to the bank; the sign flips EN ⇄ AR. */
  'finance-house': {
    cycle: 10000, still: 4600,
    trees: [[8, 40], [306, 44], [318, 34]], flowers: [110, 206, 300],
    build(g) {
      // bank: steps, columns, entablature, pediment with a coin
      rect(g, 22, GROUND - 2, 78, 2, C.grey); rect(g, 25, GROUND - 4, 72, 2, C.greyL);
      rect(g, 27, 99, 68, 5, C.white); rect(g, 27, 99, 68, 1, C.ink);
      [30, 41, 74, 85].forEach(x => { rect(g, x, 77, 7, 22, C.white); rect(g, x + 5, 77, 2, 22, '#d8d2c6'); rect(g, x - 1, 75, 9, 2, C.ink); });
      rect(g, 50, 82, 22, 17, '#4a3530'); rect(g, 49, 81, 24, 1, C.ink); px(g, 68, 91, C.gold);
      rect(g, 24, 69, 74, 6, C.white); rect(g, 24, 69, 74, 1, C.ink); rect(g, 24, 74, 74, 1, C.ink);
      for (let y = 55; y < 69; y++) {
        const hw = Math.round((y - 55) * 2.6);
        for (let x = 61 - hw; x <= 61 + hw; x++) px(g, x, y, Math.abs(x - 61) >= hw - 2 ? C.ink : C.white);
      }
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) px(g, 61 + x, 64 + y, x * x + y * y > 5 ? '#c98b2e' : C.gold);
      // reporting billboard on posts
      rect(g, 140, 92, 2, GROUND - 92, C.trunk); rect(g, 184, 92, 2, GROUND - 92, C.trunk);
      rect(g, 128, 56, 70, 37, C.ink); rect(g, 130, 58, 66, 33, C.white);
      rect(g, 133, 88, 60, 1, C.greyL); rect(g, 133, 61, 1, 28, C.greyL);
      // containers
      [[222, 94, 33, C.red, C.redD], [257, 94, 33, C.sky, '#6f9a93'], [239, 80, 33, C.gold, '#c98b2e']].forEach(([x, y, w, c, d]) => {
        rect(g, x, y, w, 14, d); rect(g, x + 1, y + 1, w - 2, 12, c);
        for (let i = x + 3; i < x + w - 3; i += 3) rect(g, i, y + 2, 1, 10, d);
        rect(g, x + w - 4, y + 3, 2, 8, C.ink);
      });
      // cables
      line(g, 222, 100, 210, 100, C.line); line(g, 210, 100, 210, 74, C.line); line(g, 210, 74, 198, 74, C.line);
      line(g, 128, 72, 98, 72, C.line);
    },
    draw(g, t, p) {
      // container status lights
      [[226, 97], [261, 97], [243, 83]].forEach(([x, y], i) => px(g, x, y, Math.floor(t / 300 + i * 2) % 3 ? C.green : C.white));

      // data flowing into the board while the report builds
      const path = [[222, 100], [210, 100], [210, 74], [198, 74]], cols = [C.red, C.sky, C.gold];
      if (p < 4200) for (let i = 0; i < 3; i++) {
        let d = (t / 35 + i * 14) % 48, k = 0;
        const segs = [12, 26, 12];
        while (k < 2 && d > segs[k]) { d -= segs[k]; k++; }
        const [ax, ay] = path[k], [bx, by] = path[k + 1], u = d / segs[k];
        rect(g, Math.round(lerp(ax, bx, u)) - 1, Math.round(lerp(ay, by, u)) - 1, 3, 3, cols[i]);
      }

      // bar chart grows, then resets at the end of the loop
      const H = [7, 11, 9, 15, 19, 25], shrink = clamp01(phase(p, 8600, 9600));
      const tops = [];
      H.forEach((h, i) => {
        const grow = ease(phase(p, 400 + i * 550, 900 + i * 550)), hh = Math.round(h * grow * (1 - shrink));
        const x = 137 + i * 9;
        if (hh > 0) { rect(g, x, 88 - hh, 6, hh, i === 5 ? C.green : C.sky); rect(g, x, 88 - hh, 6, 1, i === 5 ? C.greenD : '#6f9a93'); }
        tops.push([x + 3, 87 - hh]);
      });
      if (p >= 3800 && p < 8600) for (let i = 0; i < 5; i++) line(g, tops[i][0], tops[i][1] - 2, tops[i + 1][0], tops[i + 1][1] - 2, C.red);
      if (p >= 4000 && p < 8600 && Math.floor(p / 250) % 2) {                // "up" arrow
        line(g, 186, 66, 186, 60, C.greenD); line(g, 183, 63, 186, 60, C.greenD); line(g, 189, 63, 186, 60, C.greenD);
      }

      // bunny presents the report with a pointer, hops when it peaks
      const bx = 112, by = GROUND - 1 + (p >= 4000 && p < 5000 ? hop(phase(p, 4000, 5000), 2, 4) : 0);
      bunny(g, bx, by, { flip: true, t });
      const target = p < 4000 ? tops[Math.min(5, Math.floor(clamp01(phase(p, 400, 3700)) * 6))] : tops[5];
      if (p < 5200) line(g, bx + 7, by - 4, Math.min(target[0], 130), Math.min(target[1] + 4, 86), C.trunkL);

      // a finished report flies to the bank (investor relations)
      if (p >= 5200 && p < 7200) {
        const u = ease(phase(p, 5200, 7200)), x = Math.round(lerp(163, 61, u)), y = Math.round(lerp(70, 86, u) - Math.sin(u * Math.PI) * 18);
        rect(g, x - 3, y - 4, 7, 9, C.ink); rect(g, x - 2, y - 3, 5, 7, C.white);
        [y - 2, y, y + 2].forEach(ly => rect(g, x - 1, ly, 3, 1, C.greyD));
      }
      if (p >= 7200 && p < 8200 && Math.floor(p / 150) % 2) [[52, 84], [70, 84], [61, 80], [56, 96], [66, 96]].forEach(([x, y]) => px(g, x, y, C.gold));

      // bilingual sign over the door flips EN ⇄ AR
      const k = Math.floor(t / 1600) % 2, flipping = t % 1600 < 140;
      rect(g, 54, flipping ? 85 : 84, 14, flipping ? 3 : 7, C.ink);
      if (!flipping) text(g, k ? 'AR' : 'EN', 57, 85, C.gold);
    }
  },

  /* Buy at the stall → scan the receipt → expense logged → coins saved into the piggy bank. */
  'expense-tracker': {
    cycle: 10000, still: 6800,
    trees: [[296, 46], [314, 36], [205, 28]], flowers: [10, 112, 140, 250, 280],
    build(g) {
      // market stall
      rect(g, 22, 66, 2, GROUND - 66, C.trunk); rect(g, 86, 66, 2, GROUND - 66, C.trunk);
      for (let x = 18; x <= 91; x++) for (let y = 60; y <= 67; y++) px(g, x, y, Math.floor((x - 18) / 6) % 2 ? C.white : C.red);
      for (let x = 18; x <= 91; x++) if ((x - 18) % 6 < 4) px(g, x, 68, Math.floor((x - 18) / 6) % 2 ? C.white : C.red);
      rect(g, 18, 59, 74, 1, C.redD);
      rect(g, 24, 90, 62, GROUND - 90, C.trunkL); rect(g, 24, 90, 62, 2, C.trunk);
      for (let x = 26 + 2; x < 84; x += 8) { rect(g, x, 86, 4, 4, x % 16 ? C.red : C.gold); px(g, x + 1, 85, C.leafD); }
      // the phone (dashboard)
      rect(g, 150, 46, 41, 61, C.ink); rect(g, 167, 47, 7, 1, '#4a5a56');
      rect(g, 153, 50, 35, 52, C.white);
      rect(g, 153, 50, 35, 5, C.sky);
      rect(g, 156, 99, 29, 1, C.greyL);
      // piggy bank
      sprite(g, { pal: { p: C.pink, P: '#d98f8a', k: '#8c5a55' }, rows: [
        '...kkkkkk....', '..kppppppkk..', '.kppkpppppk.k', 'kppppppppppkk', 'kPpppppppppk.',
        'kPpppppppppk.', '.kppppppppk..', '..kpk..kpk...', '..kk...kk....'] }, 222, GROUND - 9);
      rect(g, 227, GROUND - 9, 3, 1, '#5a3a36');
    },
    draw(g, t, p, n) {
      // bunny: buys at the stall, walks over to the phone, walks back
      let bx = 92, flip = false, by = GROUND - 1;
      if (p >= 1500 && p < 2200) { const u = phase(p, 1500, 2200); bx = lerp(92, 132, u); by += hop(u, 3, 3); flip = true; }
      else if (p >= 2200 && p < 8600) { bx = 132; flip = true; }
      else if (p >= 8600 && p < 9600) { const u = phase(p, 8600, 9600); bx = lerp(132, 92, u); by += hop(u, 3, 3); }
      if (p >= 7600 && p < 8400) by += hop(phase(p, 7600, 8400), 2, 3);
      bunny(g, bx, by, { flip, t });

      // receipt pops out of the stall, goes into the phone
      const slip = (x, y) => { rect(g, x, y, 5, 7, C.white); rect(g, x, y, 5, 1, C.greyL); [y + 2, y + 4].forEach(ly => rect(g, x + 1, ly, 3, 1, C.greyD)); };
      if (p >= 700 && p < 1500) slip(Math.round(lerp(70, 92, ease(phase(p, 700, 1300)))), Math.round(lerp(84, 92, phase(p, 700, 1300)) - Math.sin(clamp01(phase(p, 700, 1300)) * Math.PI) * 10));
      else if (p >= 1500 && p < 2200) slip(Math.round(bx + 6), by - 9);
      else if (p >= 2200 && p < 2600) { const u = ease(phase(p, 2200, 2600)); slip(Math.round(lerp(138, 166, u)), Math.round(lerp(98, 62, u))); }

      // screen: header + bell
      const bell = p >= 7600 && p < 8400, sh = bell && Math.floor(t / 90) % 2 ? 1 : 0;
      rect(g, 155, 51, 8, 3, C.white);
      if (bell) { rect(g, 181 + sh, 51, 4, 3, C.gold); px(g, 182 + sh, 54, C.gold); }

      // screen: top card changes with the story
      const balance = String(1240 - 24 * (n % 3) - (p >= 3600 ? 24 : 0));
      if (p >= 2600 && p < 3600) {                                 // scanning the receipt
        rect(g, 162, 58, 17, 20, C.greyL); rect(g, 163, 59, 15, 18, C.white);
        [62, 66, 70, 74].forEach((y, i) => rect(g, 165, y, i % 2 ? 8 : 11, 1, C.greyD));
        const sy = Math.round(lerp(59, 76, (p - 2600) % 500 / 500));
        rect(g, 161, sy, 19, 1, C.green);
        [[160, 57], [180, 57], [160, 78], [180, 78]].forEach(([x, y]) => px(g, x, y, C.greenD));
      } else if (p >= 3600 && p < 5600) {                          // parsed: amount + category
        text(g, '-24', 157, 59, C.red);
        rect(g, 157, 67, 14, 4, C.gold); rect(g, 158, 68, 12, 2, '#f2c46b');
        text(g, balance, 157, 74, C.ink);
      } else if (p >= 5600 && p < 8600) {                          // savings goal fills
        const fill = Math.round(lerp(8, 27, ease(phase(p, 5800, 7400))));
        rect(g, 157, 60, 27, 4, C.greyL); rect(g, 157, 60, fill, 4, C.green);
        if (p >= 7400) text(g, 'v', 162, 67, C.greenD);
        text(g, balance, 157, 74, C.ink);
      } else {
        text(g, balance, 157, 59, C.ink);
        rect(g, 157, 66, 20, 1, C.greyL); rect(g, 157, 69, 14, 1, C.greyL);
      }

      // screen: bar chart; the newest bar grows once the receipt is logged
      [10, 14, 8, 12].forEach((h, i) => rect(g, 157 + i * 6, 98 - h, 4, h, C.sky));
      const nh = Math.round(16 * ease(phase(p, 3700, 4600)) * (p < 8600 ? 1 : 1 - phase(p, 8600, 9400)));
      if (nh > 0) rect(g, 181, 98 - nh, 4, nh, C.red);

      // coins fly into the piggy bank
      if (p >= 5800 && p < 7400) for (let i = 0; i < 3; i++) {
        const u = ease(phase(p, 5800 + i * 450, 6500 + i * 450));
        if (u <= 0 || u >= 1) continue;
        const x = Math.round(lerp(190, 228, u)), y = Math.round(lerp(72, 98, u) - Math.sin(u * Math.PI) * 14);
        rect(g, x - 1, y - 1, 3, 3, C.gold); px(g, x, y, '#f7dc8f');
      }
      if (p >= 7400 && p < 8400 && Math.floor(p / 160) % 2) [[220, 92], [238, 90], [229, 86], [216, 100], [242, 98]].forEach(([x, y]) => px(g, x, y, C.gold));
    }
  },

  /* Card in → packet travels (splits and reassembles) → queue → server → approved → cash out. */
  pravega: {
    cycle: 10000, still: 7800,
    trees: [[100, 40], [292, 46], [310, 36]], flowers: [14, 120, 200, 278],
    build(g) {
      // ATM
      rect(g, 28, 70, 26, GROUND - 70, C.ink); rect(g, 29, 71, 24, GROUND - 71, C.greyL);
      rect(g, 29, 71, 24, 4, C.red); rect(g, 33, 72, 6, 2, C.gold);
      rect(g, 33, 77, 16, 10, C.ink);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) rect(g, 33 + i * 3, 90 + j * 3, 2, 2, C.greyD);
      rect(g, 44, 90, 6, 1, C.ink); rect(g, 34, 100, 14, 2, C.ink);
      // cable on posts
      [[64, 66], [180, 66]].forEach(([x, y]) => { rect(g, x, y, 2, GROUND - y, C.trunk); rect(g, x - 1, y - 1, 4, 1, C.dirtD); });
      line(g, 53, 73, 64, 66, C.line); line(g, 64, 66, 132, 66, C.line); line(g, 160, 66, 226, 66, C.line);
      // queue (job tray with three slots)
      rect(g, 132, 60, 29, 14, C.ink); rect(g, 133, 61, 27, 12, '#3d5a52');
      [0, 1, 2].forEach(i => rect(g, 135 + i * 8, 65, 6, 6, '#2f4a43'));
      rect(g, 136, 74, 2, GROUND - 74, C.trunk); rect(g, 155, 74, 2, GROUND - 74, C.trunk);
      // server rack
      rect(g, 226, 52, 28, GROUND - 52, C.ink); rect(g, 228, 54, 24, GROUND - 56, '#3a4a46');
      for (let y = 56; y < GROUND - 4; y += 7) rect(g, 229, y, 22, 5, '#2b3734');
    },
    draw(g, t, p) {
      // server LEDs, faster while processing
      const busy = p >= 4600 && p < 5400;
      for (let y = 56, k = 0; y < GROUND - 4; y += 7, k++) for (let i = 0; i < 3; i++)
        if ((Math.floor(t / (busy ? 70 : 400)) + k * 3 + i * 5) % 4) px(g, 231 + i * 3, y + 2, (k + i) % 3 ? C.green : C.gold);
      // other jobs ticking through the queue
      const shift = Math.floor(t / 700) % 3;
      [0, 1].forEach(i => rect(g, 136 + ((i + shift) % 3) * 8, 66, 4, 4, C.greyD));

      // ATM screen
      rect(g, 34, 78, 14, 8, p >= 6800 && p < 8600 ? '#e5f4e6' : '#bfe0d8');
      if (p >= 6800 && p < 8600) text(g, 'v', 39, 79, C.greenD);
      else if (p >= 1200 && p < 6800) [0, 1, 2].forEach(i => { if (Math.floor(p / 250) % 3 >= i) rect(g, 37 + i * 3, 81, 2, 2, C.ink); });
      else if (Math.floor(t / 500) % 2) rect(g, 36, 80, 1, 4, C.ink);

      // card goes in
      let bx = 56, by = GROUND - 1;
      if (p < 1200) {
        const u = ease(phase(p, 200, 1100));
        if (p < 1100) rect(g, Math.round(lerp(56, 45, u)), Math.round(lerp(98, 89, u)), 5, 3, C.red);
      }
      // packet along the cable: ATM → queue (split + reassemble) → queue → server, then back
      const P = [[53, 73], [64, 66], [132, 66]], Q = [[160, 66], [226, 66]];
      const along = (pts, u) => {
        const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), total = segs.reduce((a, b) => a + b);
        let d = clamp01(u) * total, k = 0; while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; }
        return [lerp(pts[k][0], pts[k + 1][0], d / segs[k]), lerp(pts[k][1], pts[k + 1][1], d / segs[k])];
      };
      const packet = (x, y, c, split = 0) => {
        x = Math.round(x) - 2; y = Math.round(y) - 2;
        rect(g, x, y - split, 4, 2, c); rect(g, x, y + 2 + split, 4, 2, c);
        if (!split) rect(g, x, y + 1, 4, 2, c);
      };
      if (p >= 1200 && p < 2600) {
        const u = phase(p, 1200, 2600), [x, y] = along(P, ease(u));
        const split = u > 0.4 && u < 0.75 ? Math.round(Math.sin(phase(u, 0.4, 0.75) * Math.PI) * 3) : 0;
        packet(x, y, C.gold, split);
        if (u >= 0.75 && u < 0.85) [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([dx, dy]) => px(g, x + dx, y + dy, C.white));
      } else if (p < 3600 && p >= 2600) packet(lerp(138, 154, phase(p, 2600, 3600)), 68, C.gold);
      else if (p >= 3600 && p < 4600) { const [x, y] = along(Q, ease(phase(p, 3600, 4600))); packet(x, y, C.gold); }
      else if (busy) packet(240, 60, Math.floor(p / 120) % 2 ? C.gold : C.green);
      else if (p >= 5400 && p < 6800) {
        const u = ease(phase(p, 5400, 6800)), back = [...P, ...Q].reverse(), [x, y] = along(back, u);
        packet(x, y, C.green);
      }
      // cash out, bunny hops
      if (p >= 7400 && p < 9200) {
        [0, 1].forEach(i => {
          const u = ease(phase(p, 7400 + i * 300, 8000 + i * 300));
          if (u > 0) { rect(g, 36 + i * 4, Math.round(100 + u * 4), 7, 3, C.greenD); rect(g, 37 + i * 4, Math.round(101 + u * 4), 5, 1, C.green); }
        });
        by += hop(phase(p, 7800, 8800), 2, 4);
      }
      bunny(g, bx, by, { t });
      if (p >= 8000 && p < 9200 && Math.floor(p / 200) % 2) [[52, 80], [66, 82], [58, 76]].forEach(([x, y]) => px(g, x, y, C.gold));
    }
  }
};

/* ---------- Runner ---------- */
const S = SCENES[cv.dataset.scene];
if (!S) return;
const g = cv.getContext('2d');
cv.width = W; cv.height = H;

const backdrop = (() => {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const b = c.getContext('2d'), r = rng(7);
  S.trees.forEach(([x, h]) => pine(b, r, x, GROUND, h));
  for (let x = 0; x < W; x++) {
    px(b, x, GROUND, C.grass); px(b, x, GROUND + 1, C.grassD); px(b, x, GROUND + 2, C.dirtL);
    for (let y = GROUND + 3; y < H; y++) px(b, x, y, r() < 0.06 ? C.dirtD : r() < 0.05 ? C.dirtL : C.dirt);
    if (r() < 0.45) { const th = 1 + Math.floor(r() * 3); for (let k = 1; k <= th; k++) px(b, x, GROUND - k, k === th ? C.grassD : C.grass); }
  }
  S.flowers.forEach(x => {
    px(b, x, GROUND - 1, C.grassD); px(b, x, GROUND - 2, C.grassD);
    px(b, x - 1, GROUND - 3, C.red); px(b, x + 1, GROUND - 3, C.red); px(b, x, GROUND - 4, C.red); px(b, x, GROUND - 3, C.pink);
  });
  S.build(b);
  return c;
})();

const clouds = [
  { c: makeCloud(90, 44, [[22, 30, 13], [42, 20, 18], [64, 24, 14], [78, 32, 9], [50, 34, 12]]), x: 30, y: 36, spd: 0.0012 },
  { c: makeCloud(110, 50, [[22, 34, 12], [46, 22, 20], [74, 20, 18], [94, 32, 12], [60, 38, 13]]), x: 170, y: 30, spd: 0.0009 },
  { c: makeCloud(40, 20, [[10, 13, 7], [21, 9, 9], [32, 13, 6]]), x: 270, y: 22, spd: 0.002 }
];

const skyLayer = document.createElement('canvas'); skyLayer.width = W; skyLayer.height = H;

function drawTo(ctx, t, opts) {
  ctx.clearRect(0, 0, W, H);
  clouds.forEach(cl => {
    const w = cl.c.width, x = ((cl.x + w + t * cl.spd) % (W + w)) - w;
    ctx.drawImage(cl.c, Math.round(x), cl.y);
  });
  if (S.sky) { const sky = skyLayer.getContext('2d'); sky.clearRect(0, 0, W, H); S.sky(sky, t, t % S.cycle); ctx.drawImage(skyLayer, 0, 0); }
  ctx.drawImage(backdrop, 0, 0);
  S.draw(ctx, t, t % S.cycle, Math.floor(t / S.cycle), opts);
}
const draw = t => drawTo(g, t);
window.__drawScene = draw;   // handy for previewing individual frames

// lets a banner mini-game reuse this scene: draw frames elsewhere, read the bunny, pause the loop
let paused = false;
window.SceneAPI = {
  size: { W, H, GROUND },
  renderFrame: (ctx, t, opts = {}) => drawTo(ctx, t, opts),
  lastBunny: () => S.lastBunny || null,
  pause: () => { paused = true; },
  resume: () => { paused = false; }
};

if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  draw(S.still);
} else {
  let visible = true, last = -1e9;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const loop = ts => {
    if (!paused && visible && !document.hidden && ts - last > 110) { draw(ts); last = ts; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
})();
