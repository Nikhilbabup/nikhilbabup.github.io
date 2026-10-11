/* Carrot Harvest: carrots pop out of six holes; pull them before they sink back. Leave the bugs alone. 45 seconds.
   The logic (create, bot) runs in Node for tests; the rest draws it and needs play/kit.js. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, GROUND = 104, HOLES = 6, ROUND = 45000, RISE = 120;
const holeX = i => 40 + i * 48;
const POINTS = { carrot: 1, golden: 3, bug: -2 };

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, timeLeft: ROUND, score: 0, pulled: 0, missed: 0, bugs: 0, cursor: 2, pops: [], untilNext: 450, pullAt: -1e9, pullHole: 2 };

  function spawn() {
    const k = Math.min(1, s.t / ROUND);
    const free = [];
    for (let i = 0; i < HOLES; i++) if (!s.pops.some(p => p.hole === i)) free.push(i);
    s.untilNext = 820 - 420 * k + rand() * 240;
    if (!free.length) return;
    const r = rand();
    const kind = r < 0.1 ? 'golden' : r < 0.22 + 0.1 * k ? 'bug' : 'carrot';
    const life = (1500 - 650 * k) * (kind === 'golden' ? 0.7 : 1);
    s.pops.push({ hole: free[Math.floor(rand() * free.length)], kind, age: 0, life });
  }
  function pull(hole, ev) {
    s.cursor = hole; s.pullAt = s.t; s.pullHole = hole;
    const i = s.pops.findIndex(p => p.hole === hole && p.age > RISE / 2);
    if (i < 0) { ev.push({ type: 'whiff', hole }); return; }
    const p = s.pops.splice(i, 1)[0], points = POINTS[p.kind];
    s.score = Math.max(0, s.score + points);
    if (p.kind === 'bug') s.bugs++; else s.pulled++;
    ev.push({ type: 'pull', hole, kind: p.kind, points });
  }

  function step(dt, input) {
    const ev = [];
    input.events.forEach(e => {
      if (e.type === 'tap' && e.kind !== 'move') {
        const h = Math.round((e.x - holeX(0)) / 48);
        if (h >= 0 && h < HOLES && Math.abs(e.x - holeX(h)) < 24) pull(h, ev);
      } else if (e.type === 'press') {
        if (e.a === 'left') s.cursor = Math.max(0, s.cursor - 1);
        else if (e.a === 'right') s.cursor = Math.min(HOLES - 1, s.cursor + 1);
        else if (e.a === 'act') pull(s.cursor, ev);
        else if (/^h\d$/.test(e.a)) pull(+e.a[1], ev);
      }
    });
    s.t += dt; s.timeLeft = Math.max(0, ROUND - s.t);
    s.pops.forEach(p => { p.age += dt; });
    s.pops = s.pops.filter(p => {
      if (p.age < p.life) return true;
      if (p.kind !== 'bug') { s.missed++; ev.push({ type: 'miss', hole: p.hole }); }
      return false;
    });
    s.untilNext -= dt;
    if (s.untilNext <= 0) spawn();
    if (s.timeLeft === 0) { s.phase = 'over'; ev.push({ type: 'over', score: s.score }); }
    return ev;
  }
  return { state: s, step };
}

// self-play for the preview: pull every carrot a moment after it pops up, never a bug
function bot(s, act, memo) {
  if (s.t < (memo.wait || 0)) return;
  const p = s.pops.find(q => q.kind !== 'bug' && q.age > 180);
  if (p) { act.tap(holeX(p.hole), 96); memo.wait = s.t + 260; }
}

const def = { id: 'carrots', W, H, create, bot, holeX, ROUND };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, backdrop, drawBackdrop, effects, reduced } = K;
const ART = { carrot: SPR.carrot, golden: SPR.goldCarrot, bug: SPR.bug[0] };
def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, GROUND), fx = effects();
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      drawBackdrop(g, b, W, now);
      for (let i = 0; i < HOLES; i++) {                     // the holes: a dark dip with a lip of soil
        const x = holeX(i);
        rect(g, x - 7, GROUND, 14, 1, C.dirtD); rect(g, x - 6, GROUND + 1, 12, 2, C.dirtD); rect(g, x - 4, GROUND + 3, 8, 1, C.dirtD);
        rect(g, x - 8, GROUND - 1, 2, 1, C.dirtL); rect(g, x + 6, GROUND - 1, 2, 1, C.dirtL);
      }
      s.pops.forEach(p => {
        const up = Math.min(1, p.age / RISE, (p.life - p.age) / RISE), art = p.kind === 'bug' ? SPR.bug[Math.floor(now / 140) % 2] : ART[p.kind];
        const h = art.rows.length, w = art.rows[0].length, x = holeX(p.hole) - (w >> 1);
        g.save(); g.beginPath(); g.rect(0, 0, W, GROUND + 1); g.clip();
        sprite(g, art, x, GROUND + 1 - Math.round(h * up) - (p.kind === 'bug' ? 0 : 1), { outline: p.kind === 'golden' ? C.cream : null });
        g.restore();
        if (p.kind === 'golden' && up === 1 && (reduced || Math.floor(now / 200) % 2)) K.px(g, x + w + 1, GROUND - h - 2, C.gold);
      });
      // the bunny stands by the hole it's working, and hops when it pulls
      const hole = s.phase === 'play' && s.t - s.pullAt < 160 ? s.pullHole : s.cursor, hop = s.phase === 'play' && s.t - s.pullAt < 160;
      const bx = holeX(hole) - 15, by = GROUND - 12 - (hop ? 3 : 0);
      sprite(g, hop ? SPR.bunnyAir : SPR.bunny, bx, by, { flip: true, outline: C.outline });
      if (s.phase === 'play') rect(g, holeX(s.cursor) - 1, GROUND + 6, 3, 1, C.gold);   // cursor for keyboard players
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'pull') {
        const good = e.points > 0;
        fx.float(holeX(e.hole), GROUND - 22, (good ? '+' : '') + e.points, good ? (e.kind === 'golden' ? '#c48a2a' : C.greenD) : C.redD, now);
        fx.sparkle(holeX(e.hole), GROUND - 8, good ? C.green : C.red, now);
      } else if (e.type === 'whiff') fx.splat(holeX(e.hole), GROUND - 1, C.dirtL, now);
    },
    clear: () => fx.clear()
  };
};

def.ui = {
  title: 'Carrot Harvest', lead: 'Carrots keep popping up all over the field. Pull each one before it sinks back down, and leave the bugs alone.',
  keys: 'Tap / ← → + Space / 1–6', tap: true,
  keymap: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'act', Enter: 'act',
            Digit1: 'h0', Digit2: 'h1', Digit3: 'h2', Digit4: 'h3', Digit5: 'h4', Digit6: 'h5' },
  hud: [['score', 'Score'], ['time', 'Time', 's'], ['pulled', 'Carrots'], ['best', 'Best']],
  feel: {
    pull: e => e.kind === 'bug'
      ? { sfx: 'hit', shake: 2, x: holeX(e.hole), y: GROUND - 6, burst: [['#e0645a', '#2f3e3a'], 8] }
      : { sfx: 'coin', x: holeX(e.hole), y: GROUND - 8, ring: '#e8b04a', burst: [['#e8843a', '#5f9a5a', '#c4a28f'], 7] },
    whiff: e => ({ sfx: 'miss', x: holeX(e.hole), y: GROUND, burst: [['#c4a28f', '#a8786a'], 5, { up: 25, spread: 20 }] })
  },
  stats: s => [['Carrots', s.pulled], ['Got away', s.missed], ['Bugs pulled', s.bugs]],
  stars: [15, 30, 45],
  values: (s, best) => ({ score: s.score, time: Math.ceil(s.timeLeft / 1000), pulled: s.pulled, best }),
  intro: ['Carrot Harvest', 'Tap a carrot to pull it, or move with ← → and press Space. Keys 1–6 pull a hole directly. 45 seconds.'],
  rules: [
    '<b>Pull</b> a carrot by tapping it, by pressing its number key (1–6), or by moving the bunny with ← → and pressing Space.',
    '<b>Carrots</b> are worth 1 point. <b>Golden carrots</b> are worth 3 but duck back down faster.',
    '<b>Bugs</b> pop up too. Pulling one costs 2 points, so let them sink.',
    'The field gets busier and faster as the 45 seconds run out.'],
  say(e) {
    if (e.type === 'pull') return e.kind === 'bug' ? 'A bug! Minus two.' : e.kind === 'golden' ? 'Golden carrot! +3' : 'Carrot! +1';
    if (e.type === 'miss') return 'One got away.';
    return '';
  },
  end: (e, s, best) => ['Harvest done!', 'You pulled ' + s.pulled + (s.pulled === 1 ? ' carrot' : ' carrots') + ' for ' + e.score +
    (e.isBest && e.score > 0 ? ' points (new best!)' : ' points') + '. Best: ' + best + '.']
};
K.register(def);
})();
