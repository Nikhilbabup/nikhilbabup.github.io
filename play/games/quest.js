/* Bunny Quest: a side-scrolling platformer in three short levels (Meadow, Server Room, Release Day).
   Run and jump (hold for higher), stomp bugs, bump ? blocks for carrots, cross pits and moving platforms,
   and grab the flagpole (higher is worth more) before the timer runs out. Score and lives carry between levels.
   Part 1 is pure logic and runs in Node for tests; the rest draws it and needs play/kit.js. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const T = 8, ROWS = 15, W = 320, H = 120, FLOOR = 13, TIME = 100000, LIVES = 3;
const SOLID = new Set(['#', 'B', '?', 'u', '=', 'R', 'r']);
const PW = 6, PH = 11;
const ACC = 0.0006, FRIC = 0.0008, MAX = 0.1, GRAV = 0.0009, JUMP = -0.27, MAX_FALL = 0.32, COYOTE = 80, BUFFER = 100;
const POLE_TOP = 2 * T, POLE_BOTTOM = 12 * T;
const ENEMY = { bug: { w: 8, h: 6, speed: 0.025 }, spike: { w: 8, h: 7, speed: 0.03 }, fly: { w: 9, h: 8, speed: 0 } };

/* ---------- levels: built from data ---------- */
// rows: [col, row, pattern] (B brick, ? block) · racks: [col, height] · stairs: [col, steps, up] · enemies: [col, kind, row?]
// carrots: [col, row] · platforms: [col, row, tiles, range px, period ms, phase]
const LEVELS = [
  { name: 'Meadow', theme: 'meadow', cols: 128, speed: 1, checkpoint: 62, flag: 120, house: 122,
    pits: [[34, 36], [66, 68], [92, 94]],
    rows: [[12, 9, '?'], [17, 9, 'B?B?B'], [19, 5, '?'], [42, 9, 'BB?BB'], [49, 5, 'BBBBBBB'], [58, 9, '?'], [78, 9, 'B?B'], [80, 5, '?']],
    racks: [[24, 2], [29, 3], [60, 3], [73, 4]],
    stairs: [[100, 4, true], [104, 4, false], [112, 5, true]],
    enemies: [[22, 'bug'], [27, 'bug'], [40, 'bug'], [52, 'bug', 5], [63, 'bug'], [64, 'bug'], [76, 'bug'], [86, 'bug'], [88, 'bug'], [109, 'bug']],
    carrots: [[8, 10], [9, 10], [10, 10], [34, 9], [35, 8], [36, 9], [50, 3], [52, 3], [54, 3], [66, 9], [67, 8], [68, 9], [84, 10], [85, 10], [86, 10], [92, 9], [93, 8], [94, 9], [103, 7]],
    platforms: [] },
  { name: 'Server Room', theme: 'server', cols: 136, speed: 1.15, checkpoint: 62, flag: 129, house: 131,
    pits: [[22, 25], [52, 55], [82, 95]],
    rows: [[16, 9, 'B?B'], [46, 9, '?B?'], [47, 5, '?'], [106, 9, 'BBB?BBB'], [118, 9, '??']],
    racks: [[12, 3], [30, 4], [36, 2], [42, 4], [60, 3], [66, 4], [74, 2], [102, 4]],
    stairs: [[122, 4, true]],
    enemies: [[20, 'bug'], [33, 'fly', 6], [46, 'bug'], [49, 'fly', 6], [58, 'bug'], [64, 'bug'], [70, 'fly', 8], [78, 'bug'], [99, 'bug'], [110, 'bug'], [112, 'bug'], [116, 'fly', 8]],
    carrots: [[6, 10], [7, 10], [23, 8], [24, 8], [31, 7], [53, 8], [54, 8], [86, 7], [93, 6], [108, 6], [110, 6], [112, 6]],
    platforms: [[83, 10, 4, 12, 2600, 0], [90, 9, 4, 12, 2600, Math.PI]] },
  { name: 'Release Day', theme: 'release', cols: 146, speed: 1.35, checkpoint: 72, flag: 137, house: 139,
    pits: [[18, 20], [42, 45], [68, 70], [94, 97]],
    rows: [[10, 9, '?B?'], [26, 9, 'BBB'], [27, 5, '?'], [50, 9, 'B?B?B'], [74, 9, '??'], [79, 5, 'BBBBBB']],
    racks: [[34, 3], [58, 4], [86, 4]],
    stairs: [[114, 4, true], [118, 4, false], [126, 8, true]],
    enemies: [[14, 'bug'], [24, 'spike'], [31, 'bug'], [38, 'bug'], [54, 'spike'], [62, 'bug'], [64, 'bug'], [77, 'spike'], [82, 'bug', 5], [90, 'bug'], [102, 'spike'], [106, 'bug'], [108, 'bug'], [110, 'bug']],
    carrots: [[5, 10], [6, 10], [19, 8], [43, 8], [44, 8], [27, 3], [69, 8], [80, 3], [82, 3], [84, 3], [95, 8], [96, 8], [117, 7]],
    platforms: [] }
];

function build(i) {
  const spec = LEVELS[i], cols = spec.cols;
  const tiles = Array.from({ length: ROWS }, () => Array(cols).fill('.'));
  const put = (c, r, ch) => { if (c >= 0 && c < cols && r >= 0 && r < ROWS) tiles[r][c] = ch; };
  for (let c = 0; c < cols; c++) if (!spec.pits.some(([a, b]) => c >= a && c <= b)) { put(c, FLOOR, '#'); put(c, FLOOR + 1, '#'); }
  spec.rows.forEach(([c0, r, pat]) => [...pat].forEach((ch, k) => put(c0 + k, r, ch)));
  spec.racks.forEach(([c, h]) => { for (let k = 1; k <= h; k++) { put(c, FLOOR - k, k === h ? 'R' : 'r'); put(c + 1, FLOOR - k, k === h ? 'R' : 'r'); } });
  spec.stairs.forEach(([c0, n, up]) => { for (let k = 0; k < n; k++) for (let j = 1; j <= (up ? k + 1 : n - k); j++) put(c0 + k, FLOOR - j, '='); });
  put(spec.flag, FLOOR - 1, '=');                      // the flagpole's base block
  const enemies = spec.enemies.map(([c, kind, r = FLOOR], k) => {
    const e = ENEMY[kind];
    return { kind, x: c * T, y: r * T - e.h, w: e.w, h: e.h, vx: -e.speed * spec.speed, vy: 0, alive: true, awake: false,
             x0: c * T, y0: r * T, ph: k * 1.7, t: 0 };
  });
  const carrots = spec.carrots.map(([c, r]) => ({ x: c * T + 1, y: r * T, taken: false }));
  const plats = spec.platforms.map(([c, r, n, range, period, ph]) => ({ x0: c * T, x: c * T, y: r * T, w: n * T, range, period, ph, dx: 0 }));
  return { index: i, name: spec.name, theme: spec.theme, cols, tiles, enemies, carrots, plats,
           checkpoint: spec.checkpoint, flag: spec.flag, house: spec.house };
}

const solidAt = (L, c, r) => (c < 0 || c >= L.cols) ? true : (r < 0 || r >= ROWS) ? false : SOLID.has(L.tiles[r][c]);
function moveX(L, b, dx) {
  b.x += dx;
  const r0 = Math.floor(b.y / T), r1 = Math.floor((b.y + b.h - 0.01) / T);
  if (dx > 0) { const c = Math.floor((b.x + b.w - 0.01) / T); for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { b.x = c * T - b.w; return true; } }
  else if (dx < 0) { const c = Math.floor(b.x / T); for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { b.x = (c + 1) * T; return true; } }
  return false;
}
function moveY(L, b, dy) {
  b.y += dy;
  const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 0.01) / T);
  if (dy > 0) {
    const r = Math.floor((b.y + b.h) / T);             // resting exactly on a tile counts as landing, so standing never flickers
    for (let c = c0; c <= c1; c++) if (solidAt(L, c, r) && r >= 0) { b.y = r * T - b.h; return { land: true }; }
  } else if (dy < 0) {
    const r = Math.floor(b.y / T), hit = [];
    for (let c = c0; c <= c1; c++) if (r >= 0 && r < ROWS && c >= 0 && c < L.cols && SOLID.has(L.tiles[r][c])) hit.push(c);
    if (hit.length) { b.y = (r + 1) * T; return { head: hit, r }; }
  }
  return null;
}

/* ---------- the game ---------- */
function create(seed = 1, { level = 0 } = {}) {
  const s = { phase: 'ready', mode: 'intro', t: 0, modeAt: 0, score: 0, carrots: 0, lives: LIVES, level, timeLeft: TIME,
              L: null, p: null, cam: 0, cp: false, jumpBuf: 0, bumps: [], pops: [], clear: null, flagY: POLE_TOP + 1, lifeAt: 0, won: false };
  function spawnPlayer() {
    const col = s.cp ? s.L.checkpoint : 2;
    s.p = { x: col * T + 1, y: FLOOR * T - PH, w: PW, h: PH, vx: 0, vy: 0, ground: true, coyote: 0, face: 1, plat: null, inv: 0, hidden: false };
    s.cam = Math.max(0, Math.min(s.p.x - W * 0.35, s.L.cols * T - W));
  }
  function loadLevel(i) {
    s.level = i; s.L = build(i); s.cp = false; s.timeLeft = TIME; s.clear = null; s.flagY = POLE_TOP + 1;
    s.bumps = []; s.pops = []; s.mode = 'intro'; s.modeAt = s.t;
    spawnPlayer();
  }
  loadLevel(level);

  const box = o => [o.x + 1, o.y + 1, o.w - 2, o.h - 2];
  function die(ev, why) {
    if (s.mode !== 'run') return;
    s.mode = 'dying'; s.modeAt = s.t; s.p.vx = 0; s.p.vy = why === 'pit' ? 0 : -0.25;
    ev.push({ type: 'die', why, x: s.p.x + s.p.w / 2, y: s.p.y + s.p.h / 2 });
  }
  function bump(cols, r, ev) {
    const p = s.p, mid = p.x + p.w / 2;
    const c = cols.reduce((a, b) => Math.abs(b * T + 4 - mid) < Math.abs(a * T + 4 - mid) ? b : a);
    const tile = s.L.tiles[r][c];
    s.bumps.push({ c, r, t: s.t });
    if (tile === '?') {
      s.L.tiles[r][c] = 'u'; s.carrots++; s.score += 10;
      s.pops.push({ x: c * T + 1, y: r * T - 8, t: s.t });
      ev.push({ type: 'block', x: c * T + 4, y: r * T });
    } else ev.push({ type: 'brick', x: c * T + 4, y: r * T + T });
    s.L.enemies.forEach(e => {                          // a bug standing on a bumped block gets knocked off
      if (e.alive && Math.abs(e.y + e.h - r * T) < 2 && e.x + e.w > c * T && e.x < c * T + T) {
        e.alive = false; e.flip = true; e.vy = -0.18; s.score += 50; ev.push({ type: 'stomp', x: e.x + 4, y: e.y, how: 'bump' });
      }
    });
  }

  function stepPlayer(dt, held, ev) {
    const p = s.p, L = s.L;
    const dir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    if (dir) {
      p.face = dir;
      const a = ACC * (p.ground ? 1 : 0.7) * (p.vx * dir < 0 ? 2 : 1);   // turning around is snappier
      p.vx = Math.max(-MAX, Math.min(MAX, p.vx + dir * a * dt));
    } else {
      const f = FRIC * (p.ground ? 1 : 0.35) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    p.coyote = p.ground ? COYOTE : p.coyote - dt;
    if (s.jumpBuf > 0 && p.coyote > 0) { p.vy = JUMP; p.coyote = 0; s.jumpBuf = 0; p.ground = false; p.plat = null; p.jumpAt = s.t; ev.push({ type: 'jump', x: p.x + p.w / 2, y: p.y + p.h }); }
    s.jumpBuf -= dt;
    // let go of jump on the way up and gravity pulls harder: a tap is a hop, a hold is a full jump
    p.vy = Math.min(MAX_FALL, p.vy + (GRAV + (p.vy < 0 && !held.has('jump') ? GRAV * 1.6 : 0)) * dt);
    if (p.plat) p.x += p.plat.dx;                      // ride the platform
    if (moveX(L, p, p.vx * dt)) p.vx = 0;
    p.falling = p.vy > 0;                             // remembered for stomps: landing this step must not turn a stomp into a hit
    const prevBottom = p.y + p.h, res = moveY(L, p, p.vy * dt);
    const wasUp = !p.ground, fall = p.vy;
    p.ground = false; p.plat = null;
    if (res && res.land) { p.vy = 0; p.ground = true; }
    else if (res && res.head) { p.vy = 0; bump(res.head, res.r, ev); }
    if (p.vy >= 0) L.plats.forEach(pl => {             // platforms only hold you from above
      if (prevBottom <= pl.y + 0.5 && p.y + p.h >= pl.y && p.x + p.w > pl.x && p.x < pl.x + pl.w) {
        p.y = pl.y - p.h; p.vy = 0; p.ground = true; p.plat = pl;
      }
    });
    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (wasUp && p.ground && fall > 0.12) { p.landAt = s.t; ev.push({ type: 'land', x: p.x + p.w / 2, y: p.y + p.h, hard: fall > 0.25 }); }
  }

  function stepWorld(dt, ev) {
    const L = s.L, p = s.p;
    L.plats.forEach(pl => { const x = pl.x0 + Math.sin(s.t / pl.period * Math.PI * 2 + pl.ph) * pl.range; pl.dx = x - pl.x; pl.x = x; });
    L.enemies.forEach(e => {
      if (!e.alive) { if (e.flip) { e.vy += GRAV * dt; e.y += e.vy * dt; } return; }
      if (!e.awake) { if (e.x < s.cam + W + 16) e.awake = true; else return; }
      if (e.kind === 'fly') {
        e.t += dt;
        e.x = e.x0 + Math.round(Math.sin(e.t / 900 + e.ph) * 18);
        e.y = e.y0 - e.h + Math.round(Math.sin(e.t / 420 + e.ph) * 10);
        return;
      }
      e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
      if (moveX(L, e, e.vx * dt)) e.vx = -e.vx;
      const r = moveY(L, e, e.vy * dt);
      if (r && r.land) e.vy = 0;
      if (e.y > H + 16) e.alive = false;
    });
    if (s.mode !== 'run') return;
    // bugs: land on one to stomp it; any other touch hurts (spiky ones always hurt)
    for (const e of L.enemies) {
      if (!e.alive || !K.overlap(...box(p), ...box(e))) continue;
      const stomp = e.kind !== 'spike' && (p.vy > 0 || p.falling) && p.y + p.h - e.y <= 5;
      if (stomp) {
        e.alive = false; e.squashAt = s.t; s.score += 50;
        p.vy = s.heldJump ? JUMP * 0.85 : -0.17;
        ev.push({ type: 'stomp', x: e.x + 4, y: e.y });
      } else if (p.inv <= 0) { die(ev, 'hit'); return; }
    }
    L.carrots.forEach(c => {
      if (!c.taken && K.overlap(...box(p), c.x, c.y, 5, 8)) { c.taken = true; s.carrots++; s.score += 10; ev.push({ type: 'carrot', x: c.x + 2, y: c.y }); }
    });
    if (!s.cp && p.x >= L.checkpoint * T) { s.cp = true; ev.push({ type: 'checkpoint' }); }
    if (p.y > H + 4) die(ev, 'pit');
    if (p.x + p.w >= L.flag * T - 0.5) {                // touched the flagpole (or its base block): higher is worth more
      const frac = Math.max(0, Math.min(1, (POLE_BOTTOM - (p.y + p.h)) / (POLE_BOTTOM - POLE_TOP)));
      const bonus = 100 * (1 + Math.min(4, Math.floor(frac * 5)));
      s.score += bonus; s.mode = 'clear'; s.modeAt = s.t; s.clear = { stage: 'slide', at: s.t };
      p.vx = 0; p.vy = 0; p.x = L.flag * T + 3 - p.w;
      ev.push({ type: 'flag', bonus, x: L.flag * T, y: p.y });
    }
  }

  function stepClear(dt, ev) {
    const p = s.p, L = s.L, c = s.clear;
    if (c.stage === 'slide') {
      p.y = Math.min(FLOOR * T - p.h, p.y + 0.08 * dt);
      s.flagY = Math.min(POLE_BOTTOM - 7, s.flagY + 0.08 * dt);
      if (p.y >= FLOOR * T - p.h && s.flagY >= POLE_BOTTOM - 7) { c.stage = 'walk'; p.face = 1; p.x = L.flag * T + 6; }
    } else if (c.stage === 'walk') {
      p.x += 0.05 * dt; p.vx = 0.05;
      if (p.x >= L.house * T + 13) { p.hidden = true; p.vx = 0; c.stage = 'tally'; }
    } else if (c.stage === 'tally') {                  // the time left counts down into the score: 5 points a second
      const before = Math.ceil(s.timeLeft / 1000);
      s.timeLeft = Math.max(0, s.timeLeft - dt * 40);
      s.score += (before - Math.ceil(s.timeLeft / 1000)) * 5;
      if (s.timeLeft === 0) { c.stage = 'done'; c.at = s.t; ev.push({ type: 'cleared', level: s.level }); }
    } else if (s.t - c.at > 700) {
      if (s.level < LEVELS.length - 1) { loadLevel(s.level + 1); ev.push({ type: 'level', level: s.level, name: s.L.name }); }
      else { s.won = true; s.phase = 'over'; ev.push({ type: 'over', score: s.score, win: true }); }
    }
  }

  function step(dt, input) {
    const ev = [], held = input.held;
    s.heldJump = held.has('jump');
    if (input.events.some(e => e.type === 'press' && e.a === 'jump')) s.jumpBuf = BUFFER;
    for (let left = dt; left > 0 && s.phase === 'play'; left -= 8) {   // 8 ms sub-steps: nothing tunnels through a tile
      const d = Math.min(8, left), p = s.p;
      s.t += d;
      if (s.mode === 'intro') {
        s.jumpBuf = 0;
        if (s.t - s.modeAt > (s.demo ? 0 : 1300)) { s.mode = 'run'; s.modeAt = s.t; s.lifeAt = s.t; }   // previews skip the level card
        continue;
      }
      if (s.mode === 'run') {
        stepPlayer(d, held, ev);
        p.inv = Math.max(0, p.inv - d);
        s.timeLeft = Math.max(0, s.timeLeft - d);
        stepWorld(d, ev);
        if (s.mode === 'run' && s.timeLeft === 0) die(ev, 'time');
      } else if (s.mode === 'dying') {
        stepWorld(d, ev);
        if (p.vy !== 0 || s.t - s.modeAt > 250) { p.vy = Math.min(MAX_FALL, p.vy + GRAV * d); p.y += p.vy * d; }
        if (s.t - s.modeAt > 1500) {
          s.lives--; ev.push({ type: 'life', lives: s.lives });
          if (s.lives <= 0) { s.lives = 0; s.phase = 'over'; ev.push({ type: 'over', score: s.score, win: false }); break; }
          spawnPlayer(); s.p.inv = 1500; s.timeLeft = TIME; s.mode = 'run'; s.modeAt = s.t; s.lifeAt = s.t;
          s.L.enemies.forEach(e => { if (e.alive && Math.abs(e.x - s.p.x) < 80) e.alive = false; });   // a fair restart
        }
      } else if (s.mode === 'clear') { stepWorld(d, ev); stepClear(d, ev); }
      if (s.mode !== 'clear' || s.clear.stage !== 'tally') {
        const target = s.p.x + PW / 2 - W * 0.4;
        s.cam = Math.max(0, Math.min(target, s.L.cols * T - W));
      }
    }
    s.bumps = s.bumps.filter(b => s.t - b.t < 200);
    s.pops = s.pops.filter(b => s.t - b.t < 450);
    return ev;
  }
  return { state: s, step };
}

/* ---------- self-play for the preview card ---------- */
function bot(s, act, memo) {
  if (s.mode !== 'run') { act.hold('right', false); act.hold('jump', false); memo.jumping = false; return; }
  const p = s.p, L = s.L;
  act.hold('right', true);
  if (memo.jumping && p.vy >= 0 && s.t - memo.at > 120) { act.hold('jump', false); memo.jumping = false; }
  if (!p.ground) {                                   // steer in the air: settle onto a platform instead of sailing past it
    const mid = p.x + p.w / 2, under = L.plats.find(pl => pl.y >= p.y + p.h - 2 && mid > pl.x - 2 && mid < pl.x + pl.w + 2);
    if (under && p.vy > 0) {
      act.hold('right', mid < under.x + under.w * 0.45);
      act.hold('left', mid > under.x + under.w * 0.7);
    } else act.hold('left', false);
    return;
  }
  act.hold('left', false);
  const front = p.x + p.w;
  const wall = [2, 7, 12].some(d => { const c = Math.floor((front + d) / T); return solidAt(L, c, Math.floor((p.y + 1) / T)) || solidAt(L, c, Math.floor((p.y + p.h - 1) / T)); });
  const footRow = Math.floor((p.y + p.h + 1) / T);
  const gap = [5, 11].some(d => {
    const x = front + d, c = Math.floor(x / T);
    for (let r = footRow; r < ROWS; r++) if (solidAt(L, c, r)) return false;
    return !L.plats.some(pl => x >= pl.x && x <= pl.x + pl.w && pl.y >= p.y + p.h - 1);
  });
  const ahead = e => e.alive && e.awake && e.x - front > -4 && e.x - front < 30;
  const foe = L.enemies.some(e => ahead(e) && e.kind !== 'fly' && e.y + e.h > p.y - 6 && e.y < p.y + p.h + 2);
  if (L.enemies.some(e => ahead(e) && e.kind === 'fly' && e.y + e.h > p.y - 40)) { act.hold('right', false); return; }   // let a flyer drift off first
  if (gap) {                                         // only leap when there's somewhere to land: ground, or a platform in reach
    const ground = [16, 24, 32, 40, 48].some(d => { const c = Math.floor((front + d) / T); for (let r = footRow; r < ROWS; r++) if (solidAt(L, c, r)) return true; return false; });
    const plat = L.plats.some(pl => {                  // where will it be when the bunny comes down?
      const x = pl.x0 + Math.sin((s.t + 380) / pl.period * Math.PI * 2 + pl.ph) * pl.range;
      return pl !== p.plat && x < front + 34 && x + pl.w > front + 20 && pl.y > p.y + p.h - 34;
    });
    if (!ground && !plat) { act.hold('right', false); memo.lastX = p.x; return; }   // wait at the edge for a platform
  }
  memo.stuck = Math.abs(p.x - (memo.lastX ?? -1)) < 0.01 ? (memo.stuck || 0) + 1 : 0;
  memo.lastX = p.x;
  if (wall || gap || foe || memo.stuck > 20) { act.press('jump'); act.hold('jump', true); memo.jumping = true; memo.at = s.t; }
}

const def = { id: 'quest', W, H, create, bot, toScreen: (s, x, y) => [x - Math.round(s.cam), y], build, LEVELS, T, FLOOR, PW, PH, MAX, MAX_FALL, JUMP, GRAV, TIME, POLE_TOP, POLE_BOTTOM, solidAt };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, px, rect, sprite, SPR, text, backdrop, effects, reduced } = K;
const THEME = {
  meadow:  { top: C.grass, top2: C.grassD, soil: C.dirt, soilL: C.dirtL, soilD: C.dirtD, tuft: true },
  server:  { top: C.steelL, top2: C.ink, soil: C.steel, soilL: C.steelL, soilD: '#2a3532', tuft: false },
  release: { top: C.grass, top2: C.grassD, soil: C.dirt, soilL: C.dirtL, soilD: C.dirtD, tuft: true, flowers: true }
};
const STONE = { base: '#9aa09b', hi: '#c9cfca', lo: '#6b716c' };
const SPIKE = { pal: { r: '#8c6bb1', k: C.ink, y: C.gold }, rows: ['.y.y.y..', '..k..k..', '...kk...', '.krrrrk.', 'krrkrrrk', '.krrrrk.', '.k.k.k..'] };

function levelLayer(L) {
  const cv = document.createElement('canvas'); cv.width = L.cols * T; cv.height = H;
  const g = cv.getContext('2d'), th = THEME[L.theme], r = K.rng(31 + L.index);
  const tile = (c, rr) => (c >= 0 && c < L.cols && rr >= 0 && rr < ROWS) ? L.tiles[rr][c] : '.';
  for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < L.cols; c++) {
    const ch = L.tiles[rr][c], x = c * T, y = rr * T;
    if (ch === '#') {
      const top = tile(c, rr - 1) !== '#';
      rect(g, x, y, T, T, th.soil);
      for (let k = 0; k < 6; k++) px(g, x + Math.floor(r() * T), y + Math.floor(r() * T), r() < 0.5 ? th.soilD : th.soilL);
      if (top) {
        rect(g, x, y, T, 1, th.top); rect(g, x, y + 1, T, 1, th.top2); rect(g, x, y + 2, T, 1, th.soilL);
        if (th.tuft) for (let k = 0; k < T; k++) if (r() < 0.4) { const hh = 1 + Math.floor(r() * 2); rect(g, x + k, y - hh, 1, hh, hh > 1 ? C.grassD : C.grass); }
        if (th.flowers && r() < 0.12) { px(g, x + 3, y - 3, C.red); px(g, x + 3, y - 2, C.grassD); px(g, x + 3, y - 1, C.grassD); }
        if (!th.tuft && c % 3 === 0) px(g, x + 4, y + 4, C.gold);   // rivets on the server floor
      }
      if (tile(c - 1, rr) !== '#' && tile(c - 1, rr) !== '=') rect(g, x, y, 1, T, th.soilD);   // pit walls
      if (tile(c + 1, rr) !== '#' && tile(c + 1, rr) !== '=') rect(g, x + T - 1, y, 1, T, th.soilD);
    } else if (ch === '=') {
      rect(g, x, y, T, T, STONE.base); rect(g, x, y, T, 1, STONE.hi); rect(g, x, y, 1, T, STONE.hi);   // bevelled stone
      rect(g, x, y + T - 1, T, 1, STONE.lo); rect(g, x + T - 1, y, 1, T, STONE.lo);
    } else if (ch === 'R' || ch === 'r') {
      const left = tile(c - 1, rr) !== ch && !(tile(c - 1, rr) === 'R' || tile(c - 1, rr) === 'r');
      rect(g, x, y, T, T, C.steel);
      rect(g, left ? x : x + T - 1, y, 1, T, C.ink);
      if (ch === 'r') { rect(g, x + (left ? 2 : 0), y + 3, T - 2, 1, C.steelL); px(g, left ? x + 3 : x + 4, y + 5, (c + rr) % 2 ? C.green : C.gold); }
      else { rect(g, x - (left ? 1 : 0), y, T + 1, 3, C.ink); rect(g, x + (left ? 0 : 0), y + 1, T, 1, C.steelL); }
    }
  }
  return cv;
}

def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, FLOOR * T, { soil: false }), fx = effects();
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  let layer = null, layerFor = null;
  function blockAt(ch, x, y, now) {
    if (ch === 'B') {
      rect(g, x, y, T, T, '#c0705a'); rect(g, x, y, T, 1, '#d98b72');
      rect(g, x, y + 3, T, 1, C.trunk); rect(g, x, y + 7, T, 1, C.trunk); rect(g, x + 3, y, 1, 3, C.trunk); rect(g, x + 7, y + 4, 1, 3, C.trunk);
    } else if (ch === '?') {
      const shine = reduced || Math.floor(now / 350) % 3 !== 0;
      rect(g, x, y, T, T, '#c98b2e'); rect(g, x + 1, y + 1, T - 2, T - 2, shine ? C.gold : '#d9a53a');
      text(g, '?', x + 4, y + 1, C.trunk, { align: 'center' });
    } else if (ch === 'u') {
      rect(g, x, y, T, T, C.trunk); rect(g, x + 1, y + 1, T - 2, T - 2, '#9b6b5c');
      px(g, x + 1, y + 1, C.trunk); px(g, x + 6, y + 1, C.trunk); px(g, x + 1, y + 6, C.trunk); px(g, x + 6, y + 6, C.trunk);
    }
  }
  function house(x, y) {
    rect(g, x, y + 8, 32, 16, '#efe6d6'); rect(g, x, y + 8, 32, 1, '#e0d3bd');
    for (let k = 0; k < 9; k++) rect(g, x - 2 + k * 2, y + 8 - k, 36 - k * 4, 1, k % 2 ? C.redD : C.red);
    rect(g, x + 12, y + 14, 8, 10, C.ink); px(g, x + 18, y + 19, C.gold);
    rect(g, x + 3, y + 12, 6, 5, C.blue); rect(g, x + 23, y + 12, 6, 5, C.blue);
  }
  return {
    render(s, now) {
      const L = s.L, p = s.p, cam = Math.round(s.cam);
      if (layerFor !== L) { layer = levelLayer(L); layerFor = L; }
      g.clearRect(0, 0, W, H);
      // parallax: clouds far away, pines a little nearer
      b.clouds.forEach(cl => {
        const w = cl.c.width, span = W + w, x = (((cl.x - cam * 0.15) % span) + span) % span - w;
        g.drawImage(cl.c, Math.round(x), cl.y);
      });
      const off = -(((cam * 0.4) % W) + W) % W;
      g.drawImage(b.bg, Math.round(off), 0); g.drawImage(b.bg, Math.round(off) + W, 0);
      if (L.theme === 'server') { g.fillStyle = 'rgba(65, 82, 77, .12)'; g.fillRect(0, 0, W, H); }
      g.drawImage(layer, -cam, 0);

      g.save(); g.translate(-cam, 0);
      const c0 = Math.max(0, Math.floor(cam / T) - 1), c1 = Math.min(L.cols - 1, Math.ceil((cam + W) / T) + 1);
      for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
        const ch = L.tiles[r][c];
        if (ch !== 'B' && ch !== '?' && ch !== 'u') continue;
        const bp = s.bumps.find(q => q.c === c && q.r === r), dy = bp ? -Math.round(Math.sin(Math.PI * Math.min(1, (s.t - bp.t) / 200)) * 4) : 0;
        blockAt(ch, c * T, r * T + dy, now);
      }
      // checkpoint flag
      const cx = L.checkpoint * T + 3;
      rect(g, cx, FLOOR * T - 14, 1, 14, C.ink); rect(g, cx + 1, FLOOR * T - 14, 5, 4, s.cp ? C.green : STONE.hi);
      // the flagpole, the flag and the house
      const fxp = L.flag * T + 3;
      rect(g, fxp, POLE_TOP, 2, POLE_BOTTOM - POLE_TOP, '#cfd8d3'); rect(g, fxp + 1, POLE_TOP, 1, POLE_BOTTOM - POLE_TOP, '#9fb8ab');
      rect(g, fxp - 1, POLE_TOP - 3, 4, 3, C.gold);
      const fy = Math.round(s.flagY);
      for (let j = 0; j < 7; j++) { const w = 8 - Math.round(Math.abs(j - 3) * 2.3); rect(g, fxp - w, fy + j, w, 1, C.red); }   // a pennant
      px(g, fxp - 3, fy + 3, C.white);
      house(L.house * T, FLOOR * T - 24);
      // moving platforms
      L.plats.forEach(pl => {
        const x = Math.round(pl.x);
        rect(g, x, pl.y, pl.w, 4, C.ink); rect(g, x + 1, pl.y + 1, pl.w - 2, 1, C.steelL);
        for (let k = 3; k < pl.w; k += 6) px(g, x + k, pl.y + 2, C.gold);
      });
      // carrots and popped carrots
      L.carrots.forEach(c => { if (!c.taken) sprite(g, SPR.carrot, c.x, c.y + (reduced ? 0 : Math.round(Math.sin(now / 260 + c.x / 30)))); });
      s.pops.forEach(q => { const k = (s.t - q.t) / 450; g.globalAlpha = 1 - k; sprite(g, SPR.carrot, q.x, Math.round(q.y - k * 14)); g.globalAlpha = 1; });
      // bugs
      const legs = Math.floor(now / 140) % 2;
      L.enemies.forEach(e => {
        const x = Math.round(e.x), y = Math.round(e.y);
        if (!e.alive) {
          if (e.flip && y < H) sprite(g, SPR.bug[0], x, y, { pal: { r: C.redD } });
          else if (e.squashAt && s.t - e.squashAt < 400) { rect(g, x, y + e.h - 2, e.w, 2, C.redD); rect(g, x + 1, y + e.h - 3, e.w - 2, 1, C.red); }
          return;
        }
        if (e.kind === 'fly') {
          const up = Math.floor(now / 90) % 2;
          sprite(g, SPR.bug[legs], x, y + 2);
          rect(g, x + 1, y + (up ? 0 : 1), 3, 1, '#e8f1ee'); rect(g, x + 5, y + (up ? 0 : 1), 3, 1, '#e8f1ee');
        } else if (e.kind === 'spike') sprite(g, SPIKE, x, y);
        else sprite(g, SPR.bug[legs], x, y);
      });
      // the bunny
      if (!p.hidden && !(p.inv > 0 && Math.floor(now / 80) % 2)) {
        const air = !p.ground && s.mode !== 'clear';
        const moving = Math.abs(p.vx) > 0.01;
        const frame = s.mode === 'dying' ? SPR.bunnyAir : air ? SPR.bunnyAir : moving ? SPR.bunnyRun[Math.floor(Math.abs(p.x) / 5) % 2] : SPR.bunny;
        const up = Math.max(0, 1 - (s.t - (p.jumpAt ?? -1e9)) / 150), down = Math.max(0, 1 - (s.t - (p.landAt ?? -1e9)) / 150);
        const sx = 1 - 0.14 * up + 0.22 * down, sy = 1 + 0.2 * up - 0.24 * down;   // stretch on take-off, squash on landing
        K.spriteScaled(g, frame, Math.round(p.x) - 1, Math.round(p.y + p.h), sx, sy, { flip: p.face > 0, outline: C.outline, pal: s.mode === 'dying' || s.phase === 'over' && !s.won ? { k: C.outline } : null });
      }
      fx.draw(g, now);
      g.restore();

      // level card
      if (s.mode === 'intro' && s.phase !== 'ready' && !s.demo) {
        g.fillStyle = 'rgba(23, 63, 55, .78)'; g.fillRect(0, 44, W, 32);
        text(g, 'LEVEL ' + (s.level + 1), W / 2, 50, C.cream, { align: 'center', scale: 2 });
        text(g, L.name.toUpperCase(), W / 2, 66, C.gold, { align: 'center' });
      }
      // touch hints, on touch screens, for the first few seconds of each life
      if (coarse && s.mode === 'run' && s.t - s.lifeAt < 3000) {
        g.globalAlpha = 0.35 * (1 - (s.t - s.lifeAt) / 3000);
        rect(g, W / 3, 0, 1, H, C.ink); rect(g, W * 2 / 3, 0, 1, H, C.ink);
        text(g, '-', W / 6 - 6, H / 2, C.ink, { scale: 3 }); text(g, '+', W / 2 - 6, H / 2, C.ink, { scale: 3 });
        text(g, 'JUMP', W * 5 / 6, H / 2, C.ink, { align: 'center', scale: 2 });
        g.globalAlpha = 1;
      }
    },
    event(e, s, now) {
      if (e.type === 'stomp') { fx.float(e.x, e.y - 4, '+50', C.greenD, now); fx.sparkle(e.x, e.y + 2, C.gold, now); }
      if (e.type === 'carrot' || e.type === 'block') fx.float(e.x, e.y - 4, '+10', '#c4622a', now);
      if (e.type === 'flag') fx.float(e.x, e.y - 6, '+' + e.bonus, C.redD, now);
      if (e.type === 'checkpoint') fx.float(s.L.checkpoint * T + 4, FLOOR * T - 20, 'SAVED', C.greenD, now);
    },
    clear: () => { fx.clear(); layerFor = null; }
  };
};

const hearts = n => '♥'.repeat(n) + '♡'.repeat(Math.max(0, LIVES - n));
def.ui = {
  title: 'Bunny Quest', lead: 'Three short levels between the bunny and release day. Run, jump, stomp the bugs, bump the ? blocks and grab the flagpole as high as you can.',
  keys: '← → / A D · Space / ↑ to jump', zones: [[0, 1 / 3, 'left'], [1 / 3, 2 / 3, 'right'], [2 / 3, 1, 'jump']],
  keymap: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', Enter: 'jump' },
  hud: [['score', 'Score'], ['carrots', 'Carrots'], ['lives', 'Lives'], ['level', 'Level'], ['time', 'Time', 's'], ['best', 'Best']],
  feel: {
    jump: e => ({ sfx: 'jump', x: e.x, y: e.y, burst: [['#e4d6c0', '#c4a28f'], 4, { up: 12, spread: 22, gravity: 60, life: 320 }] }),
    land: e => ({ x: e.x, y: e.y, shake: e.hard ? 1 : 0, burst: [['#e4d6c0', '#c4a28f'], e.hard ? 8 : 5, { up: 14, spread: 34, gravity: 70, life: 360 }] }),
    stomp: e => ({ sfx: 'stomp', shake: 2, stop: 70, x: e.x, y: e.y + 2, burst: [['#e0645a', '#b84a42', '#2f3e3a'], 10] }),
    carrot: e => ({ sfx: 'coin', x: e.x, y: e.y + 4, ring: '#e8b04a' }),
    block: e => ({ sfx: 'coin', x: e.x, y: e.y - 6, ring: '#e8b04a', burst: [['#e8b04a', '#f7f3ec'], 6] }),
    brick: e => ({ sfx: 'click', x: e.x, y: e.y, burst: [['#c0705a', '#7a4c40'], 5, { up: 30 }] }),
    die: e => ({ sfx: 'hit', shake: 4, stop: 140, x: e.x, y: e.y, burst: [['#f7f3ec', '#e0645a'], 10] }),
    checkpoint: () => ({ sfx: 'pass' }),
    flag: e => ({ sfx: 'win', x: e.x, y: e.y, burst: [['#e8b04a', '#6fbf73', '#e0645a', '#f7f3ec'], 16, { spread: 60, up: 70 }] }),
    cleared: () => ({ confetti: true })
  },
  stats: s => [['Carrots', s.carrots], ['Level', (s.level + 1) + '/3'], ['Lives left', s.lives]],
  stars: [800, 1800, 2600],
  values: (s, best) => ({ score: s.score, carrots: s.carrots, lives: hearts(s.lives), level: (s.level + 1) + '/3', time: Math.ceil(s.timeLeft / 1000), best }),
  intro: ['Bunny Quest', 'Run with ← →, jump with Space or ↑ (hold it to jump higher). On touch screens: hold the left or middle third to run, tap the right third to jump.'],
  rules: [
    '<b>Run</b> with ← → (or A / D) and <b>jump</b> with Space or ↑. Hold jump for a higher jump; tap it for a hop. On touch screens, hold the left third to run left, the middle third to run right, and tap the right third to jump (two fingers at once works).',
    '<b>Bugs:</b> land on one to stomp it (+50). Touching one any other way costs a life, and the purple spiky ones can’t be stomped, so jump over them.',
    '<b>? blocks</b> give a carrot (+10) when you hit them from below, and so do the carrots you collect along the way.',
    '<b>Finish</b> by grabbing the flagpole: the higher you grab it, the bigger the bonus (100–500), and every second left on the clock adds 5 more. Three lives across three levels; the checkpoint flag saves your place.'],
  say(e) {
    if (e.type === 'stomp') return 'Stomped a bug! +50';
    if (e.type === 'carrot' || e.type === 'block') return 'Carrot +10';
    if (e.type === 'die') return e.why === 'pit' ? 'Fell into a pit!' : e.why === 'time' ? 'Out of time!' : 'Ouch, a bug!';
    if (e.type === 'checkpoint') return 'Checkpoint saved.';
    if (e.type === 'flag') return 'Flagpole! +' + e.bonus;
    if (e.type === 'level') return 'Level ' + (e.level + 1) + ': ' + e.name;
    return '';
  },
  end: (e, s, best) => e.win
    ? ['Release shipped!', 'You cleared all three levels with ' + e.score + (e.isBest ? ' points (new best!)' : ' points') + ' and ' + s.carrots + ' carrots. Best: ' + best + '.']
    : ['Game over', 'You reached level ' + (s.level + 1) + ' (' + s.L.name + ') with ' + e.score + (e.isBest && e.score > 0 ? ' points (new best!)' : ' points') + '. Best: ' + best + '.']
};
K.register(def);
})();
