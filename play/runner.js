/* Bug Runner: an endless runner starring the bunny. Jump the bugs, collect commits.
   Part 1 is pure game logic (no DOM) so it can be tested in Node; part 2 draws the world and wires input. */
(() => {
const W = 240, H = 90, GROUND = 76;   // default world: a tighter frame than the pond so the action reads at a glance

/* ---------- Part 1: game logic ---------- */
const BUNNY_X = 40, BUNNY_W = 7, BUNNY_H = 12;
const GRAVITY = 0.000533, JUMP_V = 0.1385, AIR_MS = 2 * JUMP_V / GRAVITY;  // ~18px high, ~0.52s in the air
const BUFFER_MS = 120;
const SPEED_MIN = 0.09, SPEED_MAX = 0.2, SPEED_GAIN = 0.0000013;           // px per ms
// y = height of the bottom edge above the ground
const KINDS = {
  bug:   { w: 8, h: 6,  y: 0 },
  stack: { w: 8, h: 11, y: 0 },
  fly:   { w: 9, h: 8,  y: 13 }   // too tall to jump over: stay on the ground and run under it
};
const COMMIT = { w: 5, h: 5, low: 2, high: 20, points: 10 };   // high ones sit where the bunny is at the top of a jump

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// opts (all optional): width / height / ground of the world, bunnyX (where it runs on screen),
// and for an intro: bunnyFrom (where it starts), startDist (< 0 = camera starts left of the course),
// accelMs (speed ramps up from 0), introJump (the first press also jumps), firstGap (distance to the first bug)
function createRunner(seed = 1, opts = {}) {
  const rand = rng(seed);
  const bunnyX = opts.bunnyX ?? BUNNY_X;
  const cfg = { W: opts.width ?? W, H: opts.height ?? H, GROUND: opts.ground ?? GROUND, bunnyX,
                bunnyFrom: opts.bunnyFrom ?? bunnyX, startDist: opts.startDist ?? 0, accelMs: opts.accelMs ?? 0,
                introJump: !!opts.introJump, firstGap: opts.firstGap ?? 260 };
  const s = { phase: 'ready', t: 0, dist: cfg.startDist, speed: SPEED_MIN, y: 0, vy: 0, buffered: 0, bx: cfg.bunnyFrom, cfg,
              obstacles: [], commits: [], collected: 0, score: 0, untilNext: cfg.firstGap, noFlyNext: false };

  function spawn() {
    const r = rand();
    let kind = 'bug';
    if (s.dist > 1800 && r < 0.22 && !s.noFlyNext) kind = 'fly';
    else if (s.dist > 700 && r < 0.5) kind = 'stack';
    const k = KINDS[kind];
    s.obstacles.push({ kind, x: cfg.W + 4, w: k.w, h: k.h, y: k.y });
    // the gap always fits a full jump at the current speed, plus a margin
    const gap = s.speed * AIR_MS + 40 + rand() * 110;
    s.untilNext = gap;
    s.noFlyNext = false;
    if (rand() < 0.65) {
      const high = kind !== 'fly' && rand() < 0.45;
      s.commits.push({ x: cfg.W + 4 + k.w + gap / 2, y: high ? COMMIT.high : COMMIT.low });
      s.noFlyNext = high;                       // never lure a jump into a flying bug
    }
  }

  // Advance by dt ms. `pressed` is true on the frame the player pressed jump. Returns the events that happened.
  function step(dt, pressed) {
    const ev = [];
    if (s.phase === 'over') return ev;
    if (s.phase === 'ready') {
      if (pressed) {
        s.phase = 'run'; ev.push({ type: 'start' });
        if (cfg.introJump) { s.vy = JUMP_V; ev.push({ type: 'jump' }); }   // an excited hop before the sprint
      }
      return ev;
    }
    s.t += dt;
    const ramp = cfg.accelMs ? Math.min(1, s.t / cfg.accelMs) : 1;
    s.speed = Math.min(SPEED_MAX, SPEED_MIN + s.t * SPEED_GAIN) * ramp;
    s.bx = cfg.bunnyFrom + (bunnyX - cfg.bunnyFrom) * ramp * ramp * (3 - 2 * ramp);   // sprint forward to the running spot
    const dx = s.speed * dt;
    s.dist += dx;

    // jump, with a short buffer so a press just before landing still counts
    if (pressed) s.buffered = BUFFER_MS;
    const grounded = s.y === 0 && s.vy === 0;
    if (s.buffered > 0 && grounded) { s.vy = JUMP_V; s.buffered = 0; ev.push({ type: 'jump' }); }
    else s.buffered = Math.max(0, s.buffered - dt);
    if (s.y > 0 || s.vy > 0) {
      s.y += s.vy * dt; s.vy -= GRAVITY * dt;
      if (s.y <= 0 && s.vy < 0) { s.y = 0; s.vy = 0; ev.push({ type: 'land' }); }   // only while falling, so a 0ms frame can't cancel a jump
    }

    // scroll the world
    s.obstacles.forEach(o => { o.x -= dx; });
    s.commits.forEach(c => { c.x -= dx; });
    s.obstacles = s.obstacles.filter(o => o.x + o.w > -8);
    s.commits = s.commits.filter(c => c.x + COMMIT.w > -8);
    s.untilNext -= dx;
    if (s.untilNext <= 0) spawn();

    // collisions (boxes shrunk by 1px to be forgiving)
    const bx = s.bx + 1, by = s.y + 1, bw = BUNNY_W - 2, bh = BUNNY_H - 2;
    s.commits = s.commits.filter(c => {
      if (!overlap(bx, by, bw, bh, c.x, c.y, COMMIT.w, COMMIT.h)) return true;
      s.collected++; ev.push({ type: 'commit', x: c.x, y: c.y }); return false;
    });
    s.score = Math.max(0, Math.floor(s.dist / 8)) + s.collected * COMMIT.points;
    if (s.obstacles.some(o => overlap(bx, by, bw, bh, o.x + 1, o.y + 1, o.w - 2, o.h - 2))) {
      s.phase = 'over'; ev.push({ type: 'hit', score: s.score });
    }
    return ev;
  }
  return { state: s, step };
}

if (typeof module !== 'undefined') module.exports = { createRunner, KINDS, COMMIT, BUNNY_X, BUNNY_W, BUNNY_H, AIR_MS, JUMP_V, GRAVITY, SPEED_MIN, SPEED_MAX };
if (typeof document === 'undefined') return;

/* ---------- Part 2: drawing ---------- */
const C = {
  cloud: '#f6f3ea', cloudShade: '#e3e9e1', cloudHi: '#ffffff',
  leafHi: '#cfe3c9', leafL: '#a9c9ad', leafM: '#7fa98e', leafD: '#557f6c', leafO: '#3f6656',
  trunk: '#7a4c40', trunkL: '#9b6b5c',
  grass: '#6f9f86', grassD: '#4e7f6b',
  dirtL: '#c4a28f', dirt: '#a8786a', dirtD: '#6e443a',
  red: '#e0645a', redD: '#b84a42', pink: '#eaa5a0', white: '#f7f3ec', ink: '#2f3e3a', gold: '#e8b04a'
};
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
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

// the bunny faces left in its sprite, so it's flipped to run right
const BUNNY_PAL = { w: C.white, p: C.pink, k: C.ink, r: C.red, s: '#d8d2c6' };
const BODY = ['.w.w...', '.w.w...', '.p.p...', '.wwww..', 'wwwwws.', 'wkwwws.', 'wwwpws.', '.wwws..', 'rrrrrw.', 'rrrrr..', 'rrrrs..'];
const BUNNY_RUN = [{ pal: BUNNY_PAL, rows: [...BODY, '.w.w...'] }, { pal: BUNNY_PAL, rows: [...BODY, 'w...w..'] }];
const BUNNY_AIR = { pal: BUNNY_PAL, rows: [...BODY, '..ww...'] };
const BUG_PAL = { r: C.red, k: C.ink };
const BUG = [
  { pal: BUG_PAL, rows: ['..k..k..', '...kk...', '.krrrrk.', 'krrkrrrk', '.krrrrk.', '.k.k.k..'] },
  { pal: BUG_PAL, rows: ['..k..k..', '...kk...', '.krrrrk.', 'krrkrrrk', '.krrrrk.', '..k.k.k.'] }];
const FLY_PAL = { w: '#e8f1ee', k: C.ink, g: C.redD };
const FLY = [
  { pal: FLY_PAL, rows: ['ww.....ww', '.ww...ww.', '..wkkkw..', '.kgggggk.', 'kgggkgggk', 'kgggggggk', '.kgggggk.', '..k...k..'] },
  { pal: FLY_PAL, rows: ['.........', '.........', 'wwwkkkwww', '.kgggggk.', 'kgggkgggk', 'kgggggggk', '.kgggggk.', '..k...k..'] }];
const COMMIT_SPR = { pal: { g: '#4f9a55', w: '#e5f4e6' }, rows: ['.ggg.', 'gwwwg', 'gwgwg', 'gwwwg', '.ggg.'] };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// parallax layers, each one screen wide and drawn twice side by side (built once per world size)
const layerCache = {};
function buildLayers(W, H, GROUND) {
  const key = W + 'x' + H + 'x' + GROUND;
  if (layerCache[key]) return layerCache[key];
  const sx = W / 240, sh = Math.min(1.25, GROUND / 76), sy = H / 90;
  const pines = document.createElement('canvas'); pines.width = W; pines.height = GROUND;
  const r = rng(42);
  [[10, 36], [30, 28], [58, 44], [80, 30], [118, 40], [140, 28], [170, 46], [192, 32], [218, 42], [234, 30]]
    .forEach(([x, h]) => pine(pines.getContext('2d'), r, Math.round(x * sx), GROUND, Math.round(h * sh)));
  const ground = document.createElement('canvas'); ground.width = W; ground.height = H - GROUND + 4;
  const g = ground.getContext('2d'), r2 = rng(7), top = 4;
  for (let x = 0; x < W; x++) {
    px(g, x, top, C.grass); px(g, x, top + 1, C.grassD); px(g, x, top + 2, C.dirtL);
    for (let y = top + 3; y < ground.height; y++) px(g, x, y, r2() < 0.06 ? C.dirtD : r2() < 0.05 ? C.dirtL : C.dirt);
    if (r2() < 0.45) { const th = 1 + Math.floor(r2() * 3); for (let k = 1; k <= th; k++) px(g, x, top - k, k === th ? C.grassD : C.grass); }
    if (r2() < 0.012) { px(g, x, top - 2, C.red); px(g, x, top - 1, C.grassD); }
  }
  const clouds = [
    { c: makeCloud(70, 34, [[18, 23, 10], [33, 15, 14], [50, 19, 11], [61, 25, 7], [39, 27, 9]]), x: 30 * sx, y: 6 * sy },
    { c: makeCloud(84, 38, [[17, 26, 9], [35, 17, 15], [56, 15, 14], [72, 25, 9], [46, 29, 10]]), x: 140 * sx, y: 2 * sy },
    { c: makeCloud(32, 16, [[8, 10, 6], [17, 7, 7], [26, 10, 5]]), x: 215 * sx, y: 30 * sy }
  ];
  return (layerCache[key] = { pines, ground, clouds });
}

// world: { width, height, ground }. prelude(ctx, screenX, now, bunnyX) draws whatever sits left of the course
// (world x < 0) when a game starts with startDist < 0, e.g. the farm the bunny runs out of.
function makeRenderer(cv, world = {}, prelude = null) {
  const W2 = world.width ?? W, H2 = world.height ?? H, G2 = world.ground ?? GROUND;
  const sg = cv.getContext('2d');
  cv.width = W2; cv.height = H2;
  const { pines, ground, clouds } = buildLayers(W2, H2, G2);
  const scroll = (layer, off, y) => {
    const x = -Math.round(((off % W2) + W2) % W2);
    sg.drawImage(layer, x, y); sg.drawImage(layer, x + W2, y);
  };
  let effects = [];

  function render(s, now) {
    sg.clearRect(0, 0, W2, H2);
    // while the camera is still over the intro area, the course fades in as that area scrolls away
    const intro = prelude && s.dist < 0 && s.cfg.startDist < 0;
    const reveal = intro ? Math.min(1, Math.max(0, (s.dist - s.cfg.startDist) / -s.cfg.startDist)) : 1;
    sg.globalAlpha = reveal;
    clouds.forEach(cl => {
      const w = cl.c.width, span = W2 + w, x = (((cl.x - s.dist * 0.12) % span) + span) % span - w;
      sg.drawImage(cl.c, Math.round(x), cl.y);
    });
    sg.globalAlpha = 0.55 * reveal; scroll(pines, s.dist * 0.35, 0); sg.globalAlpha = 1;   // faded for depth
    if (intro) {
      const screenX = Math.round(s.cfg.startDist - s.dist);
      prelude(sg, screenX, now, Math.round(s.bx) - screenX);
      sg.save(); sg.beginPath(); sg.rect(screenX - s.cfg.startDist, 0, W2, H2); sg.clip();   // the course starts at world x 0
      scroll(ground, s.dist, G2 - 4);
      sg.restore();
    } else scroll(ground, s.dist, G2 - 4);

    // commits bob gently
    s.commits.forEach(c => {
      const bob = reduced ? 0 : Math.round(Math.sin(now / 220 + c.x / 20));
      sprite(sg, COMMIT_SPR, Math.round(c.x), Math.round(G2 - c.y - COMMIT.h + bob), { outline: C.white });
    });
    // bugs
    const legs = Math.floor(now / 120) % 2;
    s.obstacles.forEach(o => {
      const x = Math.round(o.x), base = G2 - o.y;
      if (o.kind === 'fly') sprite(sg, FLY[Math.floor(now / 90) % 2], x, base - o.h);
      else {
        sprite(sg, BUG[legs], x, base - 6);
        if (o.kind === 'stack') sprite(sg, BUG[1 - legs], x, base - 11);
      }
    });

    // bunny
    const air = s.y > 0, by = Math.round(G2 - BUNNY_H - s.y), bx = Math.round(s.bx);
    const step = ((Math.floor(s.dist / 7) % 2) + 2) % 2;
    const frame = air ? BUNNY_AIR : BUNNY_RUN[s.phase === 'run' && s.speed > 0.02 ? step : 0];
    sprite(sg, frame, bx, by, { flip: true, outline: '#8c7f78', pal: s.phase === 'over' ? { k: '#8c7f78' } : null });
    if (s.phase === 'over') [[0, -3], [6, -4], [3, -6]].forEach(([dx, dy], i) => {
      if (reduced || Math.floor(now / 160 + i) % 2) px(sg, bx + dx, by + dy, C.gold);
    });

    // pickup sparkles
    effects = effects.filter(e => now - e.t < 320);
    effects.forEach(e => {
      const k = Math.round((now - e.t) / 60);
      [[-k, 0], [k, 0], [0, -k], [0, k]].forEach(([dx, dy]) => px(sg, e.x + dx, e.y + dy, '#6fbf73'));
    });
  }
  return {
    render,
    sparkle: (x, y, t) => effects.push({ x: Math.round(x + 2), y: Math.round(G2 - y - 3), t }),
    clear: () => { effects = []; }
  };
}

/* ---------- Part 3: a game you can mount on any canvas ---------- */
let memBest = 0;
const loadBest = () => { try { return +localStorage.getItem('runnerBest') || 0; } catch (e) { return memBest; } };
const saveBest = v => { memBest = v; try { localStorage.setItem('runnerBest', String(v)); } catch (e) { /* storage blocked */ } };
const newSeed = () => (Math.random() * 1e9) | 0;

// opts.world sizes the world; opts.prelude draws the intro area (see makeRenderer).
// opts.onEvent(event, state, best) fires for start / jump / land / commit / hit; opts.onFrame(state, best) every drawn frame.
function mount(cv, opts = {}) {
  const hooks = opts, w = opts.world || {}, worldOpts = { width: w.width, height: w.height, ground: w.ground };
  const r = makeRenderer(cv, w, opts.prelude || null);
  const keep = opts.saveBest !== false;                    // previews/demos pass saveBest: false so they never touch your best score
  let game = createRunner(newSeed(), worldOpts), pressed = false, overAt = 0, raf = 0, last = 0, now = 0, visible = true, best = keep ? loadBest() : 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);

  function onEvent(e) {
    if (e.type === 'commit') r.sparkle(e.x, e.y, now);
    if (e.type === 'hit') {
      overAt = performance.now();
      e.isBest = e.score > best;
      if (e.isBest) { best = e.score; if (keep) saveBest(best); }
    }
    if (hooks.onEvent) hooks.onEvent(e, game.state, best);
  }
  function frame(ts) {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);   // never more than one pending frame
    const dt = last ? Math.max(0, Math.min(ts - last, 33)) : 0;     // small, never-negative steps so fast bugs can't skip past the bunny
    last = ts; now = ts;
    if (!visible || document.hidden) return;
    const evs = game.step(dt, pressed);
    pressed = false;
    evs.forEach(onEvent);
    r.render(game.state, ts);
    if (hooks.onFrame) hooks.onFrame(game.state, best);
  }
  function restart() {                                 // replays skip any intro and start on the course
    game = createRunner(newSeed(), { ...worldOpts, bunnyX: game.state.cfg.bunnyX }); r.clear();
    game.step(0, true).forEach(onEvent);              // the press that restarts also starts running
  }
  r.render(game.state, 0);
  return {
    press() {
      if (game.state.phase === 'over') { if (performance.now() - overAt > 700) restart(); return; }
      pressed = true;
    },
    start({ run = false } = {}) {                       // begin the loop; run: true skips the ready screen
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (run && game.state.phase === 'ready') game.step(0, true).forEach(onEvent);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    reset(intro = {}) { game = createRunner(newSeed(), { ...worldOpts, ...intro }); r.clear(); r.render(game.state, now); },
    get state() { return game.state; },
    get best() { return best; },
    game: () => game, render: (s, t) => r.render(s, t), frame   // for tests and previews
  };
}
window.BugRunner = { createRunner, mount };
})();
