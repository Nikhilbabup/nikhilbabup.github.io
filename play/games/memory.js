/* Memory Match: sixteen cards, eight pairs of things from around the arcade. Flip two at a time to find every pair;
   fewer moves and less time score higher. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, COLS = 8, ROWS = 2, CW = 34, CH = 48, GAP = 4, X0 = 10, Y0 = 10;
const ICONS = ['carrot', 'goldCarrot', 'fish', 'egg', 'bug', 'commit', 'hen', 'boot'];
const PAIRS = ICONS.length, SHOW_MS = 800;
const cardAt = (x, y) => {
  const c = Math.floor((x - X0 + GAP / 2) / (CW + GAP)), r = Math.floor((y - Y0 + GAP / 2) / (CH + GAP));
  return c >= 0 && c < COLS && r >= 0 && r < ROWS ? r * COLS + c : -1;
};
const scoreFor = (moves, ms) => Math.max(50, 1000 - Math.max(0, moves - PAIRS) * 25 - Math.floor(ms / 1000) * 4);

function create(seed = 1) {
  const rand = K.rng(seed);
  const deck = [...ICONS, ...ICONS];
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const s = { phase: 'ready', t: 0, score: 0, moves: 0, pairs: 0, cursor: 0, showCursor: false, open: [], hideAt: 0,
              cards: deck.map(icon => ({ icon, up: false, matched: false, flipAt: -1e9 })) };

  function hideOpen() { s.open.forEach(i => { s.cards[i].up = false; s.cards[i].flipAt = s.t; }); s.open = []; }
  function flip(i, ev) {
    const c = s.cards[i];
    if (!c || c.matched || c.up) return;
    if (s.open.length === 2) hideOpen();              // don't make the player wait out a miss
    c.up = true; c.flipAt = s.t; s.open.push(i); s.cursor = i;
    ev.push({ type: 'flip', card: i });
    if (s.open.length < 2) return;
    s.moves++;
    const [a, b] = s.open;
    if (s.cards[a].icon === s.cards[b].icon) {
      s.cards[a].matched = s.cards[b].matched = true; s.open = []; s.pairs++;
      ev.push({ type: 'match', cards: [a, b], icon: c.icon });
      if (s.pairs === PAIRS) {
        s.score = scoreFor(s.moves, s.t); s.phase = 'over';
        ev.push({ type: 'over', score: s.score });
      }
    } else { s.hideAt = s.t + SHOW_MS; ev.push({ type: 'nomatch', cards: [a, b] }); }
  }

  function step(dt, input) {
    const ev = [];
    s.t += dt;
    if (s.open.length === 2 && s.t >= s.hideAt) hideOpen();
    input.events.forEach(e => {
      if (s.phase !== 'play') return;
      if (e.type === 'tap' && e.kind !== 'move') { const i = cardAt(e.x, e.y); if (i >= 0) { s.showCursor = false; flip(i, ev); } }
      else if (e.type === 'press') {
        const r = Math.floor(s.cursor / COLS), c = s.cursor % COLS;
        if (e.a === 'left') s.cursor = r * COLS + (c + COLS - 1) % COLS;
        else if (e.a === 'right') s.cursor = r * COLS + (c + 1) % COLS;
        else if (e.a === 'up' || e.a === 'down') s.cursor = ((r + 1) % ROWS) * COLS + c;
        else if (e.a === 'act') flip(s.cursor, ev);
        s.showCursor = true;
      }
    });
    if (s.phase === 'play') s.score = scoreFor(s.moves, s.t);
    return ev;
  }
  return { state: s, step };
}

// self-play: remembers every card it has seen, and plays the pair it knows when it can
function bot(s, act, memo) {
  memo.seen = memo.seen || {};
  s.cards.forEach((c, i) => { if (c.up) memo.seen[i] = c.icon; });
  if (s.t < (memo.wait || 0) || (s.open.length === 2 && s.t < s.hideAt)) return;
  const live = i => !s.cards[i].matched && !s.cards[i].up;
  const known = Object.keys(memo.seen).map(Number).filter(live);
  const unseen = s.cards.map((c, i) => i).filter(i => live(i) && !(i in memo.seen));
  let pick = -1;
  if (s.open.length === 1) {
    const icon = s.cards[s.open[0]].icon;
    pick = known.find(i => memo.seen[i] === icon) ?? -1;
  } else {
    for (const i of known) { const j = known.find(k => k !== i && memo.seen[k] === memo.seen[i]); if (j !== undefined) { pick = i; break; } }
  }
  if (pick < 0) pick = unseen.length ? unseen[Math.floor((s.t * 7) % unseen.length)] : known[0] ?? -1;
  if (pick < 0) return;
  const c = pick % COLS, r = Math.floor(pick / COLS);
  act.tap(X0 + c * (CW + GAP) + CW / 2, Y0 + r * (CH + GAP) + CH / 2);
  memo.wait = s.t + 480;
}

const def = { id: 'memory', W, H, create, bot, cardAt, scoreFor, COLS, ROWS, CW, CH, GAP, X0, Y0, PAIRS };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, size, SPR, effects } = K;
const ART = { carrot: SPR.carrot, goldCarrot: SPR.goldCarrot, fish: SPR.fish, egg: SPR.egg, bug: SPR.bug[0], commit: SPR.commit, hen: SPR.hen, boot: SPR.boot };
const BACK_BUNNY = { pal: { w: '#f9d6d2' }, rows: ['.w.w.', '.w.w.', 'wwwww', 'w.w.w', 'wwwww', '.www.'] };
def.renderer = cv => {
  const g = cv.getContext('2d'), fx = effects();
  const FLIP = 160;
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      s.cards.forEach((c, i) => {
        const col = i % COLS, row = Math.floor(i / COLS), x = X0 + col * (CW + GAP), y = Y0 + row * (CH + GAP);
        // a flip squashes the card to nothing and opens it out on the other side
        const p = Math.min(1, (s.t - c.flipAt) / FLIP), showFace = p < 0.5 ? !c.up : c.up;
        const w = Math.max(2, Math.round(CW * Math.abs(1 - 2 * p))), cx = x + (CW - w) / 2;
        const bob = c.matched && s.t - c.flipAt < 400 ? -1 : 0;
        if (showFace) {
          rect(g, cx, y + bob, w, CH, c.matched ? C.greenD : '#9fb8ab');
          rect(g, cx + 1, y + 1 + bob, w - 2, CH - 2, c.matched ? '#e5f4e6' : C.cream);
          if (w > CW - 4) {
            const art = ART[c.icon], { w: aw, h: ah } = size(art), sc = aw > 8 ? 2 : 3;
            sprite(g, art, x + Math.round((CW - aw * sc) / 2), y + bob + Math.round((CH - ah * sc) / 2), { scale: sc });
          }
        } else {
          rect(g, cx, y, w, CH, C.redD);
          rect(g, cx + 1, y + 1, w - 2, CH - 2, C.red);
          if (w > CW - 4) {
            rect(g, x + 3, y + 3, CW - 6, CH - 6, '#e57a70');
            rect(g, x + 4, y + 4, CW - 8, CH - 8, C.red);
            sprite(g, BACK_BUNNY, x + 7, y + 13, { scale: 4 });
          }
        }
        if (s.showCursor && s.cursor === i && s.phase === 'play') {
          g.strokeStyle = C.ink; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 1.5, CW + 3, CH + 3);
        }
      });
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'match') e.cards.forEach(i => fx.sparkle(X0 + (i % COLS) * (CW + GAP) + CW / 2, Y0 + Math.floor(i / COLS) * (CH + GAP) + 6, C.gold, now));
    },
    clear: () => fx.clear()
  };
};

def.ui = {
  title: 'Memory Match', lead: 'Sixteen cards, eight pairs from around the arcade. Find them all in as few moves, and as little time, as you can.',
  keys: 'Tap / arrows + Space', tap: true,
  keymap: { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'act', Enter: 'act' },
  hud: [['pairs', 'Pairs', '/8'], ['moves', 'Moves'], ['time', 'Time', 's'], ['best', 'Best']],
  night: 0.25,
  feel: {
    flip: () => ({ sfx: 'click' }),
    match: e => ({ sfx: 'coin', x: X0 + (e.cards[1] % COLS) * (CW + GAP) + CW / 2, y: Y0 + Math.floor(e.cards[1] / COLS) * (CH + GAP) + CH / 2, ring: '#e8b04a', burst: [['#e8b04a', '#6fbf73'], 8] }),
    nomatch: () => ({ sfx: 'miss' })
  },
  stats: s => [['Moves', s.moves], ['Time', Math.round(s.t / 1000) + 's']],
  stars: [500, 700, 850],
  values: (s, best) => ({ pairs: s.pairs, moves: s.moves, time: Math.floor(s.t / 1000), best }),
  intro: ['Memory Match', 'Tap a card to flip it, or use the arrow keys and Space. Find all eight pairs.'],
  rules: [
    '<b>Flip</b> two cards per move by tapping them, or by moving the outline with the arrow keys and pressing Space.',
    '<b>A match</b> stays face up. A miss flips back after a moment, or straight away when you flip the next card.',
    '<b>Your score</b> starts at 1000. Every move beyond the perfect eight costs 25 points and every second costs 4.',
    'Finish all eight pairs to set a score; a higher score is better.'],
  say(e) { return e.type === 'match' ? 'A match!' : e.type === 'nomatch' ? 'Not a match.' : ''; },
  end: (e, s, best) => ['All matched!', 'You found every pair in ' + s.moves + ' moves and ' + Math.round(s.t / 1000) + ' seconds: ' + e.score +
    (e.isBest ? ' points (new best!)' : ' points') + '. Best: ' + best + '.']
};
K.register(def);
})();
