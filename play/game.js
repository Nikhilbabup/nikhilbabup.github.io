/* Catch the Fish: a 60-second mini-game starring the bunny.
   Part 1 is pure game logic (no DOM) so it can be tested in Node; part 2 draws the pond and wires input. */
(() => {
const W = 320, H = 120, GROUND = 97, WATER = 102;

/* ---------- Part 1: game logic ---------- */
const GAME_MS = 60000;
const RULES = {
  common: { points: 1, window: 800 },
  golden: { points: 3, window: 450 },
  boot:   { points: -1, window: 900 }
};
const MS = { toss: 1100, recast: 450, penalty: 1000, escape: 700 };

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createGame(seed = 1) {
  const rand = rng(seed);
  const g = { phase: 'ready', t: 0, timeLeft: GAME_MS, score: 0, combo: 0, mult: 1, caught: 0, fish: null, waitFor: 0 };
  const go = phase => { g.phase = phase; g.t = 0; };
  const startWait = () => { go('wait'); g.fish = null; g.waitFor = 1500 + rand() * 2500; };
  const multOf = combo => Math.min(3, 1 + Math.floor(combo / 3));
  const reset = () => { g.combo = 0; g.mult = 1; };

  // Advance by dt ms. `pressed` is true on the frame the player pressed. Returns the events that happened.
  function step(dt, pressed) {
    const ev = [];
    if (g.phase === 'over') return ev;
    if (g.phase === 'ready') {
      if (pressed) { startWait(); ev.push({ type: 'start' }); }
      return ev;
    }
    g.timeLeft -= dt; g.t += dt;
    if (g.timeLeft <= 0) { g.timeLeft = 0; go('over'); ev.push({ type: 'end', score: g.score }); return ev; }

    switch (g.phase) {
      case 'wait':
        if (pressed) { reset(); go('penalty'); ev.push({ type: 'early' }); }
        else if (g.t >= g.waitFor) {
          const r = rand(), type = r < 0.6 ? 'common' : r < 0.8 ? 'golden' : 'boot';
          g.fish = { type }; go('bite'); ev.push({ type: 'bite', fish: type });
        }
        break;
      case 'bite': {
        const type = g.fish.type, rule = RULES[type];
        if (pressed) {
          if (type === 'boot') {
            g.score = Math.max(0, g.score - 1); reset();
            ev.push({ type: 'boot', points: -1 });
          } else {
            const pts = rule.points * g.mult;
            g.score += pts; g.combo++; g.caught++; g.mult = multOf(g.combo);
            ev.push({ type: 'catch', fish: type, points: pts });
          }
          go('toss');
        } else if (g.t >= rule.window) {
          if (type === 'boot') startWait();               // ignoring a boot is the right call
          else { reset(); go('escape'); ev.push({ type: 'miss' }); }
        }
        break;
      }
      case 'toss':    if (g.t >= MS.toss)    go('recast'); break;
      case 'recast':  if (g.t >= MS.recast)  startWait();  break;
      case 'penalty': if (g.t >= MS.penalty) startWait();  break;
      case 'escape':  if (g.t >= MS.escape)  startWait();  break;
    }
    return ev;
  }
  return { state: g, step };
}

if (typeof module !== 'undefined') module.exports = { createGame, RULES, MS, GAME_MS };
if (typeof document === 'undefined') return;

/* ---------- Part 2: drawing ---------- */
const C = {
  cloud: '#f6f3ea', cloudShade: '#e3e9e1', cloudHi: '#ffffff',
  leafHi: '#cfe3c9', leafL: '#a9c9ad', leafM: '#7fa98e', leafD: '#557f6c', leafO: '#3f6656',
  trunk: '#7a4c40', trunkL: '#9b6b5c',
  grass: '#6f9f86', grassD: '#4e7f6b',
  dirtL: '#c4a28f', dirt: '#a8786a', dirtD: '#6e443a',
  water: '#93bab1', waterD: '#7fa69d', waterL: '#b6d3cb', waterHi: '#d6e8e2',
  red: '#e0645a', pink: '#eaa5a0', white: '#f7f3ec', ink: '#2f3e3a',
  grey: '#9aa09b', greyD: '#6b716c', line: '#56635f', gold: '#e8b04a'
};
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
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
function sprite(g, s, x, y, { flip = false, outline = null, maxY = Infinity } = {}) {
  const w = Math.max(...s.rows.map(r => r.length));
  const at = (i, j) => s.pal[(s.rows[j] || '')[i]];
  const put = (i, j, c) => { if (y + j < maxY) px(g, x + (flip ? w - 1 - i : i), y + j, c); };
  if (outline) s.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!at(i, j)) return;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => { if (!at(i + ox, j + oy)) put(i + ox, j + oy, outline); });
  }));
  s.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (at(i, j)) put(i, j, at(i, j)); }));
}

const BUNNY = { pal: { w: C.white, p: C.pink, k: C.ink, r: C.red, s: '#d8d2c6' }, rows: [
  '.w.w...', '.w.w...', '.p.p...', '.wwww..', 'wwwwws.', 'wkwwws.', 'wwwpws.',
  '.wwws..', 'rrrrrw.', 'rrrrr..', 'rrrrs..', '.w.w...'] };
const FISH_ROWS = ['.ff..f', 'fkfffd', '.ff..f'];
const SPRITES = {
  common: { pal: { f: '#5f9fb0', d: '#3f7585', k: C.ink }, rows: FISH_ROWS },
  golden: { pal: { f: C.gold, d: '#c98b2e', k: C.ink }, rows: FISH_ROWS },
  boot:   { pal: { k: C.ink, b: C.trunk }, rows: ['.kkk.', '.kbk.', '.kbk.', 'kbbbk', 'kkkkk'] }
};

const ISLANDS = [[4, 134], [186, 316]];
const ROD_BASE = [119, 93], TIP_REST = [147, 74], TIP_UP = [142, 68], BUCKET = [105, 91];
const BUNNY_X = 114, BUNNY_Y = GROUND - BUNNY.rows.length;

function buildStatic() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(42);
  [[22, 56], [44, 44], [66, 50], [88, 34], [200, 36], [222, 44], [246, 40], [270, 58], [296, 46]]
    .forEach(([x, h]) => pine(g, r, x, GROUND, h));
  ISLANDS.forEach(([a, b]) => {
    for (let x = a; x <= b; x++) {
      px(g, x, GROUND, C.grass); px(g, x, GROUND + 1, C.dirtL);
      px(g, x, GROUND + 2, C.dirt); px(g, x, GROUND + 3, C.dirt); px(g, x, GROUND + 4, C.dirtD);
      if (r() < 0.55) { const th = 1 + Math.floor(r() * 3); for (let k = 1; k <= th; k++) px(g, x, GROUND - k, k === th ? C.grassD : C.grass); }
    }
    for (let y = GROUND; y <= GROUND + 4; y++) { px(g, a, y, C.dirtD); px(g, b, y, C.dirtD); }
  });
  [12, 76, 194, 236, 306].forEach(x => {
    px(g, x, GROUND - 1, C.grassD); px(g, x, GROUND - 2, C.grassD);
    px(g, x - 1, GROUND - 3, C.red); px(g, x + 1, GROUND - 3, C.red); px(g, x, GROUND - 4, C.red); px(g, x, GROUND - 3, C.pink);
  });
  for (let y = 93; y < GROUND; y++) for (let x = 103; x <= 107; x++) px(g, x, y, y === 93 ? C.greyD : C.grey);   // bucket
  return c;
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the pond is the same on every canvas, so its layers are built once and shared
let shared = null;
function sharedLayers() {
  if (shared) return shared;
  const wr = rng(9);
  return (shared = {
    staticLayer: buildStatic(),
    clouds: [
      { c: makeCloud(110, 60, [[26, 40, 16], [50, 28, 22], [76, 32, 18], [96, 44, 12], [12, 48, 10], [60, 48, 16]]), x: 34, y: 42, spd: 0.0012 },
      { c: makeCloud(130, 64, [[24, 44, 14], [52, 30, 24], [84, 26, 22], [108, 42, 15], [70, 50, 16]]), x: 150, y: 36, spd: 0.0009 },
      { c: makeCloud(46, 22, [[12, 14, 8], [24, 10, 10], [36, 14, 7]]), x: 250, y: 18, spd: 0.002 }
    ],
    ripples: Array.from({ length: 46 }, () => ({
      x: wr() * W, y: WATER + 2 + Math.floor(wr() * 17), len: 2 + Math.floor(wr() * 6), spd: 0.002 + wr() * 0.006, hi: wr() < 0.3
    }))
  });
}

function makeRenderer(cv) {
  const sg = cv.getContext('2d');
  cv.width = W; cv.height = H;
  const { staticLayer, clouds, ripples } = sharedLayers();

  function drawBobber(x, y) {
    [[0, -2, C.white], [-1, -1, C.red], [0, -1, C.red], [1, -1, C.red], [0, 0, C.red]].forEach(([dx, dy, c]) => {
      if (y + dy <= WATER) px(sg, x + dx, y + dy, c);
    });
  }
  const ring = (x, r, c) => { px(sg, x - r, WATER + 1, c); px(sg, x + r, WATER + 1, c); };
  const drawFish = (kind, x, y, flip) => {
    const s = SPRITES[kind], w = s.rows[0].length;
    sprite(sg, s, Math.round(x) - (w >> 1), Math.round(y) - (s.rows.length >> 1), { flip });
  };

  function render(g, now) {
    sg.clearRect(0, 0, W, H);
    clouds.forEach(cl => {
      const w = cl.c.width, x = reduced ? cl.x : ((cl.x + w + now * cl.spd) % (W + w)) - w;
      sg.drawImage(cl.c, Math.round(x), cl.y);
    });
    sg.drawImage(staticLayer, 0, 0);

    // bunny hops while reeling the catch in
    const tossU = g.phase === 'toss' ? g.t / MS.toss : 0;
    const hop = g.phase === 'toss' && !reduced ? -Math.round(Math.abs(Math.sin(tossU * Math.PI * 2)) * 3) : 0;
    sprite(sg, BUNNY, BUNNY_X, BUNNY_Y + hop, { outline: '#8c7f78', maxY: GROUND });

    sg.fillStyle = C.water; sg.fillRect(0, WATER, W, H - WATER);
    sg.fillStyle = C.waterD; ISLANDS.forEach(([a, b]) => sg.fillRect(a, WATER, b - a + 1, 2));
    ripples.forEach(r => {
      const x = Math.round(((r.x + (reduced ? 0 : now * r.spd)) % (W + 10)) - 5);
      sg.fillStyle = r.hi ? C.waterHi : C.waterL; sg.fillRect(x, r.y, r.len, 1);
    });

    drawFishing(g, now);
  }

  function drawFishing(g, now) {
    const toss = g.phase === 'toss', tu = toss ? g.t / MS.toss : 0;
    const raised = toss ? (tu < 0.15 ? tu / 0.15 : tu < 0.7 ? 1 : 1 - (tu - 0.7) / 0.3) : g.phase === 'penalty' ? 1 - clamp01(g.t / 400) * 0.5 : 0;
    const tip = [Math.round(lerp(TIP_REST[0], TIP_UP[0], raised)), Math.round(lerp(TIP_REST[1], TIP_UP[1], raised))];
    const bx = TIP_REST[0];

    line(sg, ROD_BASE[0], ROD_BASE[1] + 1, tip[0], tip[1] + 1, C.dirtD);
    line(sg, ROD_BASE[0], ROD_BASE[1], tip[0], tip[1], C.trunk);

    // fish already in the bucket
    for (let i = 0; i < Math.min(g.caught, 3); i++) px(sg, BUCKET[0] - 1 + i, BUCKET[1] + (i === 1 ? 1 : 0), C.gold);

    const type = g.fish && g.fish.type;
    switch (g.phase) {
      case 'ready': case 'wait': case 'over': {
        const down = Math.sin(now / 600) > 0.5 && !reduced ? 1 : 0;
        line(sg, tip[0], tip[1] + 1, bx, WATER - 2 + down, C.line);
        drawBobber(bx, WATER + down - 1);
        ring(bx, 3, down ? C.waterHi : C.waterL);
        break;
      }
      case 'bite': {
        const real = type !== 'boot', dip = Math.floor(g.t / (real ? 130 : 320)) % 2 ? (real ? 2 : 1) : 0;
        line(sg, tip[0], tip[1] + 1, bx, WATER - 2 + dip, C.line);
        drawBobber(bx, WATER - 1 + dip);
        ring(bx, 2 + Math.floor(g.t / 120) % 5, type === 'golden' ? C.gold : C.waterHi);
        if (real) {                                           // the "!" the player waits for
          const c = type === 'golden' ? C.gold : C.red;
          line(sg, 117, 74, 117, 79, c); line(sg, 118, 74, 118, 79, c); px(sg, 117, 82, c); px(sg, 118, 82, c);
        }
        break;
      }
      case 'toss': {
        const boot = type === 'boot', ex = boot ? 190 : BUCKET[0], ey = boot ? WATER - 1 : BUCKET[1];
        let fx, fy;
        if (tu < 0.3) {
          const k = tu / 0.3;
          fx = lerp(bx, tip[0], k); fy = lerp(WATER, tip[1] + 12, k);
          line(sg, tip[0], tip[1] + 1, fx, fy - 2, C.line);
          [[-4, -2], [4, -3], [-2, -4], [3, -1]].forEach(([dx, dy]) => px(sg, bx + dx, WATER + dy - Math.round(k * 3), C.waterHi));
        } else {
          const k = (tu - 0.3) / 0.7;
          fx = lerp(tip[0], ex, k); fy = lerp(tip[1] + 12, ey, k) - Math.sin(k * Math.PI) * (boot ? 30 : 22);
          line(sg, tip[0], tip[1] + 1, tip[0], tip[1] + 8, C.line);
        }
        const landed = tu > 0.97;
        if (!landed || boot) drawFish(type, fx, fy, tu >= 0.3);
        if (boot && tu > 0.9) ring(190, 2 + Math.floor((tu - 0.9) * 30), C.waterHi);
        if (type === 'golden' && !reduced && Math.floor(g.t / 100) % 2) [[-4, -3], [4, -2], [0, -5], [-3, 3]].forEach(([dx, dy]) => px(sg, fx + dx, fy + dy, C.gold));
        break;
      }
      case 'recast': {
        const u = g.t / MS.recast, by = Math.round(lerp(tip[1] + 8, WATER - 1, u * 2));
        line(sg, tip[0], tip[1] + 1, bx, by - 1, C.line);
        drawBobber(bx, by);
        if (u > 0.5) ring(bx, 2 + Math.floor((u - 0.5) * 10), C.waterHi);
        break;
      }
      case 'penalty': {                                       // pressed too early: line yanked, fish spooked
        line(sg, tip[0], tip[1] + 1, bx, WATER - 8, C.line);
        drawBobber(bx, WATER - 7);
        if (g.t < 700) [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].forEach(([dx, dy]) => px(sg, bx + dx, WATER - 16 + dy, C.red));
        break;
      }
      case 'escape': {                                        // missed the bite: the fish swims off
        const u = g.t / MS.escape;
        line(sg, tip[0], tip[1] + 1, bx, WATER - 2, C.line);
        drawBobber(bx, WATER - 1);
        drawFish(type, bx + u * 36, WATER + 5, true);
        break;
      }
      default: break;
    }
  }
  return { render };
}

/* ---------- Part 3: a game you can mount on any canvas ---------- */
let memBest = 0;
const loadBest = () => { try { return +localStorage.getItem('fishBest') || 0; } catch (e) { return memBest; } };
const saveBest = v => { memBest = v; try { localStorage.setItem('fishBest', String(v)); } catch (e) { /* storage blocked */ } };
const newSeed = () => (Math.random() * 1e9) | 0;

// opts.onEvent(event, state, best) fires for start / bite / catch / boot / miss / early / end;
// opts.onFrame(state, best) after every drawn frame.
function mount(cv, opts = {}) {
  const r = makeRenderer(cv);
  const keep = opts.saveBest !== false;                    // previews/demos pass saveBest: false so they never touch your best score
  let game = createGame(newSeed()), pressed = false, overAt = 0, raf = 0, last = 0, visible = true, best = keep ? loadBest() : 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);

  function onEvent(e) {
    if (e.type === 'end') {
      overAt = performance.now();
      e.isBest = e.score > best;
      if (e.isBest) { best = e.score; if (keep) saveBest(best); }
    }
    if (opts.onEvent) opts.onEvent(e, game.state, best);
  }
  function frame(ts) {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);   // never more than one pending frame
    const dt = last ? Math.max(0, Math.min(ts - last, 100)) : 0;    // never negative, even if clocks are mixed
    last = ts;
    if (!visible || document.hidden) return;
    const evs = game.step(dt, pressed);
    pressed = false;
    evs.forEach(onEvent);
    r.render(game.state, ts);
    if (opts.onFrame) opts.onFrame(game.state, best);
  }
  function restart() {
    game = createGame(newSeed());
    game.step(0, true).forEach(onEvent);                      // the press that restarts also casts the line
  }
  r.render(game.state, 0);
  return {
    press() {
      if (game.state.phase === 'over') { if (performance.now() - overAt > 700) restart(); return; }
      pressed = true;
    },
    start({ cast = false } = {}) {                             // begin the loop; cast: true skips the ready screen
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (cast && game.state.phase === 'ready') game.step(0, true).forEach(onEvent);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    reset() { game = createGame(newSeed()); },
    get state() { return game.state; },
    get best() { return best; },
    game: () => game, render: (s, t) => r.render(s, t), frame, step: (dt, p) => game.step(dt, p)   // for tests and previews
  };
}
window.FishGame = { createGame, mount };
})();
