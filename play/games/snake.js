/* Bunny Hop: a snake game. The bunny leads a line of baby bunnies around the meadow; every carrot adds one more.
   Don't hit the fence or your own line. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, CELL = 8, COLS = W / CELL, ROWS = H / CELL;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const interval = eaten => Math.max(70, 150 - eaten * 3);   // ms per step: faster with every carrot

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, score: 0, dir: 'right', queue: [], acc: 0, grow: 0, moves: 0, ateAt: -1e9,
              body: [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }], carrot: null };
  const occupied = (x, y) => s.body.some(p => p.x === x && p.y === y);
  function placeCarrot() {
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(rand() * COLS), y = Math.floor(rand() * ROWS);
      if (!occupied(x, y)) { s.carrot = { x, y }; return; }
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!occupied(x, y)) { s.carrot = { x, y }; return; }
    s.carrot = null;
  }
  placeCarrot();

  const lastDir = () => s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  function turn(d) {
    const cur = lastDir();
    if (d === cur || d === OPP[cur] || s.queue.length >= 3) return false;
    s.queue.push(d); return true;
  }
  // a tap turns toward the tapped spot: along the other axis if it's straight ahead or behind
  function tapTurn(x, y) {
    const head = s.body[0], dx = x - (head.x * CELL + CELL / 2), dy = y - (head.y * CELL + CELL / 2);
    const hor = dx < 0 ? 'left' : 'right', ver = dy < 0 ? 'up' : 'down';
    const first = Math.abs(dx) >= Math.abs(dy) ? hor : ver, second = first === hor ? ver : hor;
    if (!turn(first)) turn(second);
  }

  function move(ev) {
    if (s.queue.length) s.dir = s.queue.shift();
    const head = s.body[0], [mx, my] = DIRS[s.dir], nx = head.x + mx, ny = head.y + my;
    const tailMoves = s.grow === 0;
    const hitsSelf = s.body.some((p, i) => p.x === nx && p.y === ny && !(tailMoves && i === s.body.length - 1));
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || hitsSelf) {
      s.phase = 'over'; ev.push({ type: 'crash', x: nx, y: ny }); ev.push({ type: 'over', score: s.score }); return;
    }
    s.body.unshift({ x: nx, y: ny }); s.moves++;
    if (s.carrot && nx === s.carrot.x && ny === s.carrot.y) {
      s.score++; s.grow++; s.ateAt = s.t;
      ev.push({ type: 'eat', x: nx, y: ny, length: s.body.length });
      placeCarrot();
    }
    if (s.grow > 0) s.grow--; else s.body.pop();
  }

  function step(dt, input) {
    const ev = [];
    input.events.forEach(e => {
      if (e.type === 'press' && DIRS[e.a]) turn(e.a);
      else if (e.type === 'tap' && e.kind !== 'move') tapTurn(e.x, e.y);
    });
    s.t += dt; s.acc += dt;
    while (s.acc >= interval(s.score) && s.phase === 'play') { s.acc -= interval(s.score); move(ev); }
    return ev;
  }
  return { state: s, step };
}

// self-play: breadth-first search to the carrot, or any safe step if there's no path
function bot(s, act, memo) {
  if (s.queue.length || memo.moves === s.moves) return;
  memo.moves = s.moves;
  const blocked = new Set(s.body.slice(0, -1).map(p => p.x + ',' + p.y));
  const head = s.body[0], goal = s.carrot;
  const prev = new Map([[head.x + ',' + head.y, null]]), queue = [head];
  let found = null;
  while (queue.length && goal) {
    const c = queue.shift();
    if (c.x === goal.x && c.y === goal.y) { found = c; break; }
    for (const d of Object.keys(DIRS)) {
      const n = { x: c.x + DIRS[d][0], y: c.y + DIRS[d][1], d }, k = n.x + ',' + n.y;
      if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS || blocked.has(k) || prev.has(k)) continue;
      prev.set(k, c); queue.push(n);
    }
  }
  let want = null;
  if (found) {
    let c = found;
    while (prev.get(c.x + ',' + c.y) !== head && prev.get(c.x + ',' + c.y)) c = prev.get(c.x + ',' + c.y);
    want = c.d;
  } else {
    want = Object.keys(DIRS).find(d => {
      const x = head.x + DIRS[d][0], y = head.y + DIRS[d][1];
      return d !== OPP[s.dir] && x >= 0 && y >= 0 && x < COLS && y < ROWS && !blocked.has(x + ',' + y);
    });
  }
  if (want && want !== s.dir && want !== OPP[s.dir]) act.press(want);
}

const def = { id: 'snake', W, H, create, bot, CELL, COLS, ROWS, interval };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, effects } = K;
const HEAD_UP = ['..w..w..', '..p..p..', '..w..w..', '.wwwwww.', 'wwkwwkww', 'wwwwwwww', 'wwwppwww', '.wwwwww.'];
const rotate = rows => rows[0].split('').map((_, i) => rows.map(r => r[i]).reverse().join(''));   // 90° clockwise
const HEADS = { up: HEAD_UP };
HEADS.right = rotate(HEADS.up); HEADS.down = rotate(HEADS.right); HEADS.left = rotate(HEADS.down);
const PAL = { w: C.white, p: C.pink, k: C.ink };
const BABY = { pal: PAL, rows: ['........', '..p..p..', '..w..w..', '.wwwwww.', '.wkwwkw.', '.wwwwww.', '..wwww..', '........'] };
def.renderer = cv => {
  const g = cv.getContext('2d'), fx = effects();
  const field = document.createElement('canvas'); field.width = W; field.height = H;
  const f = field.getContext('2d');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) rect(f, x * CELL, y * CELL, CELL, CELL, (x + y) % 2 ? '#cfe3c9' : '#c4dcbd');
  rect(f, 0, 0, W, 1, C.grassD); rect(f, 0, H - 1, W, 1, C.grassD); rect(f, 0, 0, 1, H, C.grassD); rect(f, W - 1, 0, 1, H, C.grassD);
  return {
    render(s, now) {
      g.drawImage(field, 0, 0);
      if (s.carrot) sprite(g, SPR.carrot, s.carrot.x * CELL + 1, s.carrot.y * CELL);
      const over = s.phase === 'over';
      for (let i = s.body.length - 1; i > 0; i--) {
        const p = s.body[i];
        sprite(g, BABY, p.x * CELL, p.y * CELL, { outline: C.outline, pal: over ? { k: C.outline } : null });
      }
      const h = s.body[0];
      sprite(g, { pal: PAL, rows: HEADS[s.dir] }, h.x * CELL, h.y * CELL, { outline: C.outline, pal: over ? { k: C.outline } : null });
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'eat') { fx.float(e.x * CELL + 4, e.y * CELL - 4, '+1', C.redD, now); fx.sparkle(e.x * CELL + 4, e.y * CELL + 4, C.gold, now); }
      if (e.type === 'crash') fx.sparkle(K.clamp(e.x, 0, COLS - 1) * CELL + 4, K.clamp(e.y, 0, ROWS - 1) * CELL + 4, C.red, now);
    },
    clear: () => fx.clear()
  };
};

def.ui = {
  title: 'Bunny Hop', lead: 'Lead a line of baby bunnies around the meadow. Every carrot adds one more, and the line keeps getting faster.',
  keys: 'Arrows / WASD / swipe', tap: true, swipe: true,
  keymap: { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' },
  hud: [['score', 'Carrots'], ['length', 'Bunnies'], ['best', 'Best']],
  values: (s, best) => ({ score: s.score, length: s.body.length, best }),
  intro: ['Bunny Hop', 'Steer with the arrow keys or WASD, swipe, or tap where you want to turn. Eat carrots, avoid the fence and your own line.'],
  rules: [
    '<b>Steer</b> with the arrow keys or WASD, by swiping on the field, or by tapping the side you want to turn toward.',
    '<b>Carrots</b> are worth 1 point each, and every carrot adds a baby bunny to the end of the line.',
    '<b>Crashing</b> into the fence or into your own line ends the game.',
    'The line speeds up a little with every carrot you eat.'],
  say(e) { return e.type === 'eat' ? 'Carrot! The line is ' + e.length + ' bunnies long.' : e.type === 'crash' ? 'Bonk!' : ''; },
  end: (e, s, best) => ['Bonk!', 'You ate ' + e.score + (e.score === 1 ? ' carrot' : ' carrots') + (e.isBest && e.score > 0 ? ' (new best!)' : '') +
    ' with a line of ' + s.body.length + ' bunnies. Best: ' + best + '.']
};
K.register(def);
})();
