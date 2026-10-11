/* Egg Catch: hens on a perch lay eggs; slide the bunny's basket to catch them. Golden eggs are a bonus,
   rotten ones cost a life if you catch them, and every good egg that hits the ground costs a life too. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, GROUND = 110, HENS = 5, PERCH_Y = 22, LAY_Y = PERCH_Y + 6;
const BASKET_W = 16, CATCH_Y = GROUND - 17, SPEED = 0.2, LIVES = 3;
const henX = i => 48 + i * 56;

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, score: 0, caught: 0, lives: LIVES, x: W / 2, target: null, face: 1, moving: false,
              eggs: [], untilNext: 700, lastX: W / 2, laid: [] };

  const level = () => Math.min(1, s.t / 90000);
  function spawn() {
    const k = level(), interval = 1300 - 750 * k, gravity = 0.00012 + 0.0001 * k;
    const fallMs = Math.sqrt(2 * (CATCH_Y - LAY_Y) / gravity);
    s.untilNext = interval * (0.8 + rand() * 0.4);
    const r = rand(), kind = r < 0.08 ? 'golden' : r < 0.2 + 0.08 * k ? 'rotten' : 'egg';
    // a good egg is always laid within reach of where the basket needs to be for the one before it
    const reach = SPEED * (interval + fallMs) * 0.8;
    const hens = [];
    for (let i = 0; i < HENS; i++) if (kind === 'rotten' || Math.abs(henX(i) - s.lastX) <= reach) hens.push(i);
    const hen = hens[Math.floor(rand() * hens.length)];
    if (kind !== 'rotten') s.lastX = henX(hen);
    s.eggs.push({ x: henX(hen), y: LAY_Y, vy: 0, g: gravity, kind });
    s.laid[hen] = s.t;
  }

  function step(dt, input) {
    const ev = [];
    input.events.forEach(e => { if (e.type === 'tap') s.target = K.clamp(e.x, 12, W - 12); });
    const dir = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0);
    const was = s.x;
    if (dir) { s.target = null; s.x += dir * SPEED * dt; }
    else if (s.target !== null) {
      const d = s.target - s.x;
      s.x += Math.sign(d) * Math.min(Math.abs(d), SPEED * dt);
      if (Math.abs(d) < 0.5) s.target = null;
    }
    s.x = K.clamp(s.x, 12, W - 12);
    s.moving = Math.abs(s.x - was) > 0.01;
    if (s.moving) s.face = s.x > was ? 1 : -1;

    s.t += dt;
    s.eggs = s.eggs.filter(egg => {
      const prev = egg.y;
      egg.vy += egg.g * dt; egg.y += egg.vy * dt;
      if (prev < CATCH_Y && egg.y >= CATCH_Y && Math.abs(egg.x - s.x) <= BASKET_W / 2 + 1) {
        if (egg.kind === 'rotten') { s.lives--; ev.push({ type: 'rotten', x: egg.x }); }
        else {
          const points = egg.kind === 'golden' ? 5 : 1;
          s.score += points; s.caught++;
          ev.push({ type: 'catch', kind: egg.kind, points, x: egg.x });
        }
        return false;
      }
      if (egg.y >= GROUND - 4) {
        if (egg.kind !== 'rotten') { s.lives--; ev.push({ type: 'splat', kind: egg.kind, x: egg.x }); }
        else ev.push({ type: 'dodge', x: egg.x });
        return false;
      }
      return true;
    });
    s.untilNext -= dt;
    if (s.untilNext <= 0) spawn();
    if (s.lives <= 0) { s.lives = 0; s.phase = 'over'; ev.push({ type: 'over', score: s.score }); }
    return ev;
  }
  return { state: s, step };
}

// self-play: head for the good egg that will land first, stepping aside from rotten ones
function bot(s, act) {
  const good = s.eggs.filter(e => e.kind !== 'rotten').sort((a, b) => b.y - a.y);
  let target = good.length ? good[0].x : s.x;
  const bad = s.eggs.find(e => e.kind === 'rotten' && e.y > CATCH_Y - 24 && Math.abs(e.x - target) < 12);
  if (bad && (!good.length || good[0].y < bad.y)) target = bad.x + (bad.x > W / 2 ? -22 : 22);
  act.tap(target, 100, 'move');
}

const def = { id: 'eggs', W, H, create, bot, henX, CATCH_Y, BASKET_W };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, backdrop, drawBackdrop, effects } = K;
const ART = { egg: SPR.egg, golden: SPR.goldEgg, rotten: SPR.rottenEgg };
def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, GROUND), fx = effects();
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      drawBackdrop(g, b, W, now);
      // the perch: a beam on two posts
      rect(g, 6, PERCH_Y + 9, W - 12, 2, C.trunkL); rect(g, 6, PERCH_Y + 11, W - 12, 1, C.trunk);
      [8, W - 11].forEach(x => { rect(g, x, PERCH_Y + 12, 2, GROUND - PERCH_Y - 12, C.trunk); rect(g, x, PERCH_Y + 12, 1, GROUND - PERCH_Y - 12, C.trunkL); });
      for (let i = 0; i < HENS; i++) {
        const lay = s.t - (s.laid[i] ?? -1e9) < 220, bob = lay ? -1 : (Math.floor(now / 600 + i * 1.7) % 4 === 0 ? -1 : 0);
        sprite(g, SPR.hen, henX(i) - 5, PERCH_Y + bob, { flip: i % 2 === 1 });
      }
      s.eggs.forEach(egg => sprite(g, ART[egg.kind], Math.round(egg.x) - 2, Math.round(egg.y), { outline: egg.kind === 'golden' ? C.cream : null }));
      // the bunny, with the basket held over its head
      const x = Math.round(s.x), frame = s.moving && s.phase === 'play' ? SPR.bunnyRun[Math.floor(now / 110) % 2] : SPR.bunny;
      sprite(g, frame, x - 3, GROUND - 12, { flip: s.face > 0, outline: C.outline, pal: s.phase === 'over' ? { k: C.outline } : null });
      const bx = x - BASKET_W / 2;
      rect(g, bx, CATCH_Y, BASKET_W, 1, C.trunkL);
      rect(g, bx + 1, CATCH_Y + 1, BASKET_W - 2, 3, C.trunk);
      for (let i = 2; i < BASKET_W - 2; i += 3) rect(g, bx + i, CATCH_Y + 2, 1, 1, C.trunkL);
      rect(g, bx + 2, CATCH_Y + 4, BASKET_W - 4, 1, C.dirtD);
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'catch') { fx.float(e.x, CATCH_Y - 10, '+' + e.points, e.kind === 'golden' ? '#c48a2a' : C.greenD, now); fx.sparkle(e.x, CATCH_Y - 2, C.gold, now); }
      if (e.type === 'rotten') { fx.float(e.x, CATCH_Y - 10, 'YUCK', C.redD, now); fx.splat(e.x, CATCH_Y, '#7f8c6e', now); }
      if (e.type === 'splat') fx.splat(e.x, GROUND - 2, e.kind === 'golden' ? C.gold : '#f2c94c', now);
    },
    clear: () => fx.clear()
  };
};

const hearts = n => '♥'.repeat(n) + '♡'.repeat(LIVES - n);
def.ui = {
  title: 'Egg Catch', lead: 'The hens are laying faster than ever. Slide the basket under every egg, grab the golden ones and dodge the rotten ones.',
  keys: '← → / drag / tap', tap: true, drag: true,
  keymap: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' },
  hud: [['score', 'Score'], ['lives', 'Lives'], ['caught', 'Eggs'], ['best', 'Best']],
  feel: {
    catch: e => ({ sfx: 'coin', x: e.x, y: CATCH_Y - 2, ring: e.kind === 'golden' ? '#e8b04a' : '#f7f3ec' }),
    rotten: e => ({ sfx: 'hit', shake: 2, x: e.x, y: CATCH_Y, burst: [['#a9b49a', '#7f8c6e'], 9] }),
    splat: e => ({ sfx: 'miss', shake: 1, x: e.x, y: GROUND - 2, burst: [['#f2c94c', '#f7f3ec'], 8, { up: 30 }] })
  },
  stats: s => [['Eggs', s.caught]],
  stars: [15, 40, 80],
  values: (s, best) => ({ score: s.score, lives: hearts(s.lives), caught: s.caught, best }),
  intro: ['Egg Catch', 'Hold ← → or drag to move the basket. Catch every good egg; three broken eggs and it’s over.'],
  rules: [
    '<b>Move</b> by holding ← → (or A / D), dragging across the field, tapping where you want to go, or holding the buttons.',
    '<b>Eggs</b> are worth 1 point and <b>golden eggs</b> 5. Every good egg that hits the ground costs a life.',
    '<b>Rotten eggs</b> are green. Let them fall: catching one costs a life.',
    'You have three lives. The hens lay faster and the eggs fall quicker the longer you last.'],
  say(e) {
    if (e.type === 'catch') return e.kind === 'golden' ? 'Golden egg! +5' : 'Caught! +1';
    if (e.type === 'rotten') return 'A rotten egg. You lost a life.';
    if (e.type === 'splat') return 'Splat! You lost a life.';
    return '';
  },
  end: (e, s, best) => ['Out of eggs!', 'You caught ' + s.caught + (s.caught === 1 ? ' egg' : ' eggs') + ' for ' + e.score +
    (e.isBest && e.score > 0 ? ' points (new best!)' : ' points') + '. Best: ' + best + '.']
};
K.register(def);
})();
