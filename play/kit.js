/* Shared kit for the Bunny Arcade games in play/games/: a seeded RNG, a tiny pixel font, the bunny and friends
   as sprites, a meadow backdrop, and mount(), which runs any game definition on a canvas
   (frame loop, input, best score, and self-play for the previews on the grid).

   A game definition looks like:
     { id, W, H, create(seed) -> { state, step(dt, input) -> events }, bot(state, act, memo), consumeStart,
       renderer(cv) -> { render(state, now), event?(e, state, now), clear?() }, ui: {...} }
   state.phase goes 'ready' -> 'play' -> 'over'; mount() handles the ready and over phases, and an { type: 'over', score }
   event ends a game. input is { events: [{ type: 'press', a } | { type: 'tap', x, y, kind }], held: Set }. */
(() => {
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const api = { rng, clamp, overlap, defs: {}, order: [] };
api.register = def => { api.defs[def.id] = def; if (!api.order.includes(def.id)) api.order.push(def.id); };
if (typeof module !== 'undefined') { module.exports = api; return; }   // Node: just the logic helpers, for tests

/* ---------- drawing ---------- */
const C = {
  cloud: '#f6f3ea', cloudShade: '#e3e9e1', cloudHi: '#ffffff',
  leafHi: '#cfe3c9', leafL: '#a9c9ad', leafM: '#7fa98e', leafD: '#557f6c', leafO: '#3f6656',
  trunk: '#7a4c40', trunkL: '#9b6b5c',
  grass: '#6f9f86', grassD: '#4e7f6b',
  dirtL: '#c4a28f', dirt: '#a8786a', dirtD: '#6e443a',
  red: '#e0645a', redD: '#b84a42', pink: '#eaa5a0', white: '#f7f3ec', cream: '#fbf8f1', ink: '#2f3e3a', gold: '#e8b04a',
  green: '#6fbf73', greenD: '#3f9a4f', blue: '#6aa6c9', blueD: '#4a86a9', steel: '#41524d', steelL: '#55675f', outline: '#8c7f78'
};
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
function sprite(g, s, x, y, { flip = false, outline = null, pal = null, scale = 1 } = {}) {
  const P = pal ? { ...s.pal, ...pal } : s.pal, w = Math.max(...s.rows.map(r => r.length));
  const at = (i, j) => P[(s.rows[j] || '')[i]];
  const put = (i, j, c) => { g.fillStyle = c; g.fillRect((x | 0) + (flip ? w - 1 - i : i) * scale, (y | 0) + j * scale, scale, scale); };
  if (outline) s.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!at(i, j)) return;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => { if (!at(i + ox, j + oy)) put(i + ox, j + oy, outline); });
  }));
  s.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (at(i, j)) put(i, j, at(i, j)); }));
}
const size = s => ({ w: Math.max(...s.rows.map(r => r.length)), h: s.rows.length });
// squash and stretch that stays crisp pixel art: draw the sprite unscaled, then scale the copy with smoothing off.
// (x, footY) is the sprite's left edge and the line its feet stand on; sx / sy scale around the feet.
const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;
function spriteScaled(g, s, x, footY, sx, sy, opts = {}) {
  if (Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) { sprite(g, s, x, footY - s.rows.length, opts); return; }
  const { w, h } = size(s), pad = opts.outline ? 1 : 0;
  scratch.width = w + pad * 2; scratch.height = h + pad * 2;
  const sg = scratch.getContext('2d'); sg.clearRect(0, 0, scratch.width, scratch.height);
  sprite(sg, s, pad, pad, opts);
  const dw = Math.round(scratch.width * sx), dh = Math.round(scratch.height * sy);
  const smooth = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(scratch, Math.round(x - pad + (scratch.width - dw) / 2), Math.round(footY + pad - dh), dw, dh);
  g.imageSmoothingEnabled = smooth;
}

// a 3×5 pixel font: each glyph is five rows of three bits
const FONT = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
  5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6],
  '+': [0, 2, 7, 2, 0], '-': [0, 0, 7, 0, 0], '!': [2, 2, 2, 0, 2], '.': [0, 0, 0, 0, 2], '/': [1, 1, 2, 4, 4],
  '×': [0, 5, 2, 5, 0], '?': [6, 1, 2, 0, 2], ':': [0, 2, 0, 2, 0], ' ': [0, 0, 0, 0, 0]
};
const textWidth = (str, scale = 1) => (String(str).length * 4 - 1) * scale;
function text(g, str, x, y, c, { align = 'left', scale = 1 } = {}) {
  str = String(str).toUpperCase();
  const w = textWidth(str, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  g.fillStyle = c;
  for (const ch of str) {
    const gl = FONT[ch];
    if (gl) gl.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row & (4 >> i)) g.fillRect(cx + i * scale, (y | 0) + j * scale, scale, scale); });
    cx += 4 * scale;
  }
  return w;
}

/* ---------- sprites ---------- */
// the bunny faces left in its sprite: draw it with flip: true to face right
const BUNNY_PAL = { w: C.white, p: C.pink, k: C.ink, r: C.red, s: '#d8d2c6' };
const BODY = ['.w.w...', '.w.w...', '.p.p...', '.wwww..', 'wwwwws.', 'wkwwws.', 'wwwpws.', '.wwws..', 'rrrrrw.', 'rrrrr..', 'rrrrs..'];
const BUG_PAL = { r: C.red, k: C.ink };
const CARROT_PAL = { g: '#5f9a5a', G: '#3f7a45', o: '#e8843a', d: '#c4622a' };
const CARROT_ROWS = ['g.g.g', '.gGg.', '..G..', '.ooo.', '.ooo.', '.odo.', '..o..', '..d..'];
const EGG_ROWS = ['.ee.', 'eeee', 'eeee', 'eees', '.ss.'];
const SPR = {
  bunny: { pal: BUNNY_PAL, rows: [...BODY, '.w.w...'] },
  bunnyRun: [{ pal: BUNNY_PAL, rows: [...BODY, '.w.w...'] }, { pal: BUNNY_PAL, rows: [...BODY, 'w...w..'] }],
  bunnyAir: { pal: BUNNY_PAL, rows: [...BODY, '..ww...'] },
  bug: [
    { pal: BUG_PAL, rows: ['..k..k..', '...kk...', '.krrrrk.', 'krrkrrrk', '.krrrrk.', '.k.k.k..'] },
    { pal: BUG_PAL, rows: ['..k..k..', '...kk...', '.krrrrk.', 'krrkrrrk', '.krrrrk.', '..k.k.k.'] }],
  commit: { pal: { g: '#4f9a55', w: '#e5f4e6' }, rows: ['.ggg.', 'gwwwg', 'gwgwg', 'gwwwg', '.ggg.'] },
  carrot: { pal: CARROT_PAL, rows: CARROT_ROWS },
  goldCarrot: { pal: { ...CARROT_PAL, o: '#f2c94c', d: '#d9a53a' }, rows: CARROT_ROWS },
  egg: { pal: { e: C.white, s: '#e3dccd' }, rows: EGG_ROWS },
  goldEgg: { pal: { e: '#f2c94c', s: '#d9a53a' }, rows: EGG_ROWS },
  rottenEgg: { pal: { e: '#a9b49a', s: '#7f8c6e', k: '#6b7a5c' }, rows: ['.ee.', 'ekee', 'eeke', 'eksk', '.ss.'] },
  hen: { pal: { w: C.white, r: C.red, y: C.gold, k: C.ink, s: '#d8d2c6', l: C.gold },
    rows: ['......r...', '.....rww..', '.....wkwy.', 's....www..', 'ss..wwww..', 'swwwwwww..', '.wwwwwws..', '..wwwss...', '...l.l....'] },
  fish: { pal: { b: C.blue, d: C.blueD, k: C.ink }, rows: ['...bbb...', '.bbbbbb.b', 'bkbbbbbbb', '.bbbbbb.b', '...ddd...'] },
  boot: { pal: { n: C.trunk, d: C.dirtD }, rows: ['.nnn...', '.nnn...', '.nnn...', '.nnnnn.', 'nnnnnnn', 'ddddddd'] },
  heart: { pal: { r: C.red }, rows: ['rr.rr', 'rrrrr', '.rrr.', '..r..'] }
};

/* ---------- backdrop: drifting clouds, faded pines and a strip of meadow (cached per size) ---------- */
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
  for (let y = base - trunkH; y < base; y++) { px(g, cx - 1, y, C.trunkL); px(g, cx, y, C.trunk); px(g, cx + 1, y, C.trunk); }
  const top = base - trunkH - h + 3, tl = h / 4, maxHW = h * 0.27;
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
const cache = {};
function backdrop(W, H, ground, { pines = true, soil = true } = {}) {
  const key = [W, H, ground, pines, soil].join('x');
  if (cache[key]) return cache[key];
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const g = bg.getContext('2d');
  if (pines) {
    const layer = document.createElement('canvas'); layer.width = W; layer.height = ground;
    const r = rng(42), sx = W / 240, sh = Math.min(1.25, ground / 76);
    [[10, 36], [30, 28], [58, 44], [80, 30], [118, 40], [140, 28], [170, 46], [192, 32], [218, 42], [234, 30]]
      .forEach(([x, h]) => pine(layer.getContext('2d'), r, Math.round(x * sx), ground, Math.round(h * sh)));
    g.globalAlpha = 0.45; g.drawImage(layer, 0, 0); g.globalAlpha = 1;
  }
  const r2 = rng(7);
  if (soil) for (let x = 0; x < W; x++) {
    px(g, x, ground, C.grass); px(g, x, ground + 1, C.grassD); px(g, x, ground + 2, C.dirtL);
    for (let y = ground + 3; y < H; y++) px(g, x, y, r2() < 0.06 ? C.dirtD : r2() < 0.05 ? C.dirtL : C.dirt);
    if (r2() < 0.45) { const th = 1 + Math.floor(r2() * 3); for (let k = 1; k <= th; k++) px(g, x, ground - k, k === th ? C.grassD : C.grass); }
    if (r2() < 0.012) { px(g, x, ground - 2, C.red); px(g, x, ground - 1, C.grassD); }
  }
  const s = W / 320;
  const clouds = [
    { c: makeCloud(70, 34, [[18, 23, 10], [33, 15, 14], [50, 19, 11], [61, 25, 7], [39, 27, 9]]), x: 40 * s, y: 4 },
    { c: makeCloud(84, 38, [[17, 26, 9], [35, 17, 15], [56, 15, 14], [72, 25, 9], [46, 29, 10]]), x: 190 * s, y: 0 },
    { c: makeCloud(32, 16, [[8, 10, 6], [17, 7, 7], [26, 10, 5]]), x: 290 * s, y: 26 }
  ];
  return (cache[key] = { bg, clouds });
}
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function drawBackdrop(g, b, W, now) {
  b.clouds.forEach(cl => {
    const w = cl.c.width, span = W + w, x = (((cl.x + (reduced ? 0 : now * 0.004)) % span) + span) % span - w;
    g.drawImage(cl.c, Math.round(x), cl.y);
  });
  g.drawImage(b.bg, 0, 0);
}

// short-lived effects: floating score text and sparkles
function effects() {
  let list = [];
  return {
    float(x, y, str, color, t) { list.push({ kind: 'float', x, y, str, color, t }); },
    sparkle(x, y, color, t) { list.push({ kind: 'sparkle', x, y, color, t }); },
    splat(x, y, color, t) { list.push({ kind: 'splat', x, y, color, t }); },
    draw(g, now) {
      list = list.filter(e => now - e.t < (e.kind === 'float' ? 700 : 360));
      list.forEach(e => {
        const age = now - e.t;
        if (e.kind === 'float') { g.globalAlpha = 1 - age / 700; text(g, e.str, e.x, e.y - age / 50, e.color, { align: 'center' }); g.globalAlpha = 1; }
        else if (e.kind === 'sparkle') {
          const k = Math.round(age / 60);
          [[-k, 0], [k, 0], [0, -k], [0, k]].forEach(([dx, dy]) => px(g, e.x + dx, e.y + dy, e.color));
        } else {
          const k = Math.round(age / 90);
          [[-2 - k, 0], [-1 - k, -1], [1 + k, -1], [2 + k, 0], [0, -1 - k]].forEach(([dx, dy]) => px(g, e.x + dx, e.y + dy, e.color));
          rect(g, e.x - 2, e.y, 5, 1, e.color);
        }
      });
    },
    clear() { list = []; }
  };
}

/* ---------- mount: run a game definition on a canvas ---------- */
let memBest = {};
const loadBest = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return memBest[k] || 0; } };
const saveBest = (k, v) => { memBest[k] = v; try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } };
const newSeed = () => (Math.random() * 1e9) | 0;

// opts: onEvent(e, state, best), onFrame(state, best), saveBest: false (previews), autoplay: true (the game plays itself)
function mount(cv, def, opts = {}) {
  const keep = opts.saveBest !== false && !opts.autoplay, bestKey = def.id + 'Best';
  cv.width = def.W; cv.height = def.H;
  const r = def.renderer(cv), held = new Set(), memo = {};
  const fresh = () => { const g = def.create(newSeed()); if (opts.autoplay) g.state.demo = true; return g; };   // demo: a game playing itself
  let game = fresh(), queue = [], overAt = 0, raf = 0, last = 0, now = 0, visible = true, restartTimer = 0, frozenUntil = 0;
  let best = keep ? loadBest(bestKey) : 0;
  if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const act = { press: a => queue.push({ type: 'press', a }), tap: (x, y, kind = 'down') => queue.push({ type: 'tap', x, y, kind }),
                hold: (a, on) => { if (on) held.add(a); else held.delete(a); } };   // hold: keys a bot keeps down
  const clearMemo = () => Object.keys(memo).forEach(k => delete memo[k]);

  function emit(e) {
    if (e.type === 'over') {
      overAt = performance.now();
      e.isBest = e.score > best;
      if (e.isBest) { best = e.score; if (keep) saveBest(bestKey, best); }
      if (opts.autoplay) { clearTimeout(restartTimer); restartTimer = setTimeout(restart, 1800); }
    }
    if (r.event) r.event(e, game.state, now);
    if (opts.onEvent) opts.onEvent(e, game.state, best);
  }
  function begin() { game.state.phase = 'play'; emit({ type: 'start' }); }
  function restart() { game = fresh(); queue = []; clearMemo(); if (r.clear) r.clear(); begin(); }
  function tick(dt) {
    const s = game.state;
    if (opts.autoplay && s.phase === 'play' && def.bot) def.bot(s, act, memo);
    const inp = queue; queue = [];
    const wants = inp.some(e => !(e.type === 'tap' && e.kind === 'move'));   // dragging alone never starts or restarts a game
    if (s.phase === 'over') { if (!opts.autoplay && wants && performance.now() - overAt > 700) restart(); return; }
    if (s.phase === 'ready') { if (!wants) return; begin(); if (def.consumeStart) return; }
    game.step(dt, { events: inp, held }).forEach(emit);
  }
  function frame(ts) {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);    // never more than one pending frame
    const dt = last ? Math.max(0, Math.min(ts - last, 33)) : 0;      // small, never-negative steps
    last = ts; now = ts;
    if (!visible || document.hidden) return;
    if (ts >= frozenUntil) tick(dt);                 // hit-stop: keep drawing, but hold the game still
    r.render(game.state, ts);
    if (opts.onFrame) opts.onFrame(game.state, best);
  }
  r.render(game.state, 0);
  return {
    press(a = 'act') { held.add(a); queue.push({ type: 'press', a }); },
    release(a) { held.delete(a); },
    releaseAll() { held.clear(); },
    tap(x, y, kind = 'down') { queue.push({ type: 'tap', x, y, kind }); },
    start({ auto = false } = {}) {                                   // auto: skip the ready screen
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (auto && game.state.phase === 'ready') begin();
      else if (opts.autoplay && game.state.phase === 'over') restart();
    },
    stop() { cancelAnimationFrame(raf); raf = 0; clearTimeout(restartTimer); held.clear(); },
    reset() { game = fresh(); queue = []; held.clear(); clearMemo(); if (r.clear) r.clear(); r.render(game.state, now); },
    freeze(ms) { frozenUntil = Math.max(frozenUntil, (now || performance.now()) + ms); },   // timed in frame time
    get state() { return game.state; },
    get best() { return best; },
    game: () => game, render: (s, t) => r.render(s, t), frame, tick             // for tests
  };
}

Object.assign(api, { C, px, rect, sprite, spriteScaled, size, text, textWidth, SPR, backdrop, drawBackdrop, effects, mount, reduced });
window.Arcade = api;
})();
