/* Queue Sorter: requests ride a conveyor to the bunny's router. Send each one to the right server
   (GET to the cache, POST to the database, 500 errors to the logs) before the queue overflows. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, REQ_W = 26, REQ_H = 12, SLOT = REQ_W + 3, FRONT_X = 186, BELT_Y = 54, QUEUE_MAX = 7, LIVES = 3;
const BELT_SPEED = 0.09, FLY_MS = 360;
const TYPES = { get: { lane: 'top', label: 'GET' }, post: { lane: 'mid', label: 'POST' }, err: { lane: 'bot', label: '500' } };
const LANES = { top: { y: 7, name: 'CACHE' }, mid: { y: 47, name: 'DB' }, bot: { y: 87, name: 'LOGS' } };

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, score: 0, routed: 0, lives: LIVES, reqs: [], flying: [], untilNext: 200, wrongAt: -1e9 };
  const level = () => Math.min(1, s.t / 90000);
  function spawn() {
    const r = rand(), type = r < 0.45 ? 'get' : r < 0.8 ? 'post' : 'err';
    s.reqs.push({ type, x: -REQ_W });
    s.untilNext = (1400 - 1080 * level()) * (0.7 + rand() * 0.6);
  }
  const arrived = () => s.reqs.length && s.reqs[0].x >= FRONT_X - 6;
  function route(lane, ev) {
    if (!arrived()) return;
    const req = s.reqs.shift(), ok = TYPES[req.type].lane === lane;
    s.flying.push({ type: req.type, lane, ok, age: 0 });
    if (ok) { s.routed++; s.score += 10; ev.push({ type: 'route', ok, req: req.type, lane }); }
    else {
      s.lives--; s.wrongAt = s.t; ev.push({ type: 'route', ok, req: req.type, lane });
      if (s.lives <= 0) { s.phase = 'over'; ev.push({ type: 'over', score: s.score, reason: 'wrong' }); }
    }
  }
  function step(dt, input) {
    const ev = [];
    for (const e of input.events) {
      if (e.type === 'press' && LANES[e.a]) route(e.a, ev);
      else if (e.type === 'tap' && e.kind !== 'move') route(e.y < 40 ? 'top' : e.y < 80 ? 'mid' : 'bot', ev);
      if (s.phase === 'over') return ev;
    }
    s.t += dt;
    s.reqs.forEach((r, i) => { r.x = Math.min(FRONT_X - i * SLOT, r.x + BELT_SPEED * dt); });
    s.flying.forEach(f => { f.age += dt; });
    s.flying = s.flying.filter(f => f.age < FLY_MS + 200);
    s.untilNext -= dt;
    if (s.untilNext <= 0) spawn();
    if (s.reqs.length > QUEUE_MAX) { s.phase = 'over'; ev.push({ type: 'overflow' }); ev.push({ type: 'over', score: s.score, reason: 'overflow' }); }
    return ev;
  }
  return { state: s, step };
}

// self-play: route the front request correctly, at a human-ish pace
function bot(s, act, memo) {
  if (s.t < (memo.wait || 0) || !s.reqs.length || s.reqs[0].x < FRONT_X - 6) return;
  act.press(TYPES[s.reqs[0].type].lane); memo.wait = s.t + 330;
}

const def = { id: 'queue', W, H, create, bot, TYPES, FRONT_X, QUEUE_MAX };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, text, backdrop, drawBackdrop, effects, reduced } = K;
const COLOR = { get: [C.green, C.greenD], post: [C.blue, C.blueD], err: [C.red, C.redD] };
const LANE_TYPE = { top: 'get', mid: 'post', bot: 'err' };
const SX = 262, SW = 52, SH = 26, RX = 214, RW = 20;
function req(g, type, x, y, alpha = 1) {
  const [fill, edge] = COLOR[type];
  g.globalAlpha = alpha;
  rect(g, x, y, REQ_W, REQ_H, edge); rect(g, x + 1, y + 1, REQ_W - 2, REQ_H - 2, fill);
  text(g, TYPES[type].label, x + REQ_W / 2, y + 4, '#ffffff', { align: 'center' });
  g.globalAlpha = 1;
}
def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, 116, { pines: false }), fx = effects();
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      drawBackdrop(g, b, W, now);
      // the conveyor belt
      rect(g, 0, BELT_Y + REQ_H, RX, 4, C.ink);
      const off = reduced ? 0 : Math.floor(s.t * BELT_SPEED) % 6;
      for (let x = -6 + off; x < RX; x += 6) rect(g, x, BELT_Y + REQ_H + 1, 3, 2, C.steelL);
      for (let x = 10; x < RX; x += 40) { rect(g, x, BELT_Y + REQ_H + 4, 2, 116 - BELT_Y - REQ_H - 4, C.steel); }
      // pipes from the router to the servers
      Object.keys(LANES).forEach(k => {
        const ly = LANES[k].y + SH / 2, mid = BELT_Y + REQ_H / 2;
        rect(g, RX + RW, mid - 1, 8, 3, '#9fb8ab');
        rect(g, RX + RW + 7, Math.min(ly, mid) - 1, 3, Math.abs(ly - mid) + 3, '#9fb8ab');
        rect(g, RX + RW + 7, ly - 1, SX - RX - RW - 7, 3, '#9fb8ab');
      });
      // the servers, each with a stripe in the colour it accepts
      Object.keys(LANES).forEach(k => {
        const { y, name } = LANES[k], [fill] = COLOR[LANE_TYPE[k]];
        const wrong = s.t - s.wrongAt < 400 && s.flying.some(f => !f.ok && f.lane === k);
        rect(g, SX, y, SW, SH, wrong ? C.redD : C.ink); rect(g, SX + 1, y + 1, SW - 2, SH - 2, C.steel);
        rect(g, SX + 1, y + 1, 3, SH - 2, fill);
        text(g, name, SX + 8, y + 5, C.cream);
        text(g, TYPES[LANE_TYPE[k]].label, SX + 8, y + 15, fill);
        const on = reduced || Math.floor(now / 300 + y) % 2;
        rect(g, SX + SW - 5, y + 4, 2, 1, on ? C.green : '#2a3532');
      });
      // the router and the bunny running it
      rect(g, RX, BELT_Y - 4, RW, REQ_H + 8, C.ink); rect(g, RX + 1, BELT_Y - 3, RW - 2, REQ_H + 6, C.steelL);
      rect(g, RX + 4, BELT_Y + 2, RW - 8, 2, C.gold);
      sprite(g, SPR.bunny, RX + 6, BELT_Y - 16, { flip: true, outline: C.outline, pal: s.phase === 'over' ? { k: C.outline } : null });
      // the queue
      s.reqs.forEach(r => req(g, r.type, Math.round(r.x), BELT_Y));
      // a warning at the end of the belt when the queue is nearly full
      if (s.reqs.length >= QUEUE_MAX - 1 && (reduced || Math.floor(now / 200) % 2)) rect(g, 0, BELT_Y - 3, 2, REQ_H + 6, C.red);
      // routed requests fly down their pipe
      s.flying.forEach(f => {
        const p = Math.min(1, f.age / FLY_MS), ly = LANES[f.lane].y + (SH - REQ_H) / 2;
        const x = FRONT_X + (SX + 6 - FRONT_X) * p, y = BELT_Y + (ly - BELT_Y) * p * p;
        const fade = f.age > FLY_MS ? 1 - (f.age - FLY_MS) / 200 : 1;
        req(g, f.ok ? f.type : 'err', Math.round(x), Math.round(y), fade * (p < 1 ? 1 : 0.8));
      });
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'route') {
        const y = LANES[e.lane].y;
        if (e.ok) { fx.float(SX - 12, y + SH / 2 + 2, '+10', C.greenD, now); fx.sparkle(SX + SW - 8, y + SH / 2, C.gold, now); }
        else fx.float(SX - 16, y + SH / 2 + 2, 'WRONG', C.redD, now);
      }
    },
    clear: () => fx.clear()
  };
};

const hearts = n => '♥'.repeat(n) + '♡'.repeat(LIVES - n);
def.ui = {
  title: 'Queue Sorter', lead: 'Requests are piling up at the bunny’s router. Send GETs to the cache, POSTs to the database and 500 errors to the logs.',
  keys: '↑ → ↓ / 1 2 3 / tap', tap: true,
  keymap: { ArrowUp: 'top', KeyW: 'top', Digit1: 'top', ArrowRight: 'mid', KeyD: 'mid', Digit2: 'mid', ArrowDown: 'bot', KeyS: 'bot', Digit3: 'bot' },
  hud: [['score', 'Score'], ['queue', 'Queue', '/' + QUEUE_MAX], ['lives', 'Lives'], ['best', 'Best']],
  night: 0.3,
  feel: {
    route: e => e.ok
      ? { sfx: 'coin', x: SX + SW - 8, y: LANES[e.lane].y + SH / 2, ring: '#e8b04a' }
      : { sfx: 'hit', shake: 2, x: SX + SW / 2, y: LANES[e.lane].y + SH / 2, burst: [['#e0645a', '#2f3e3a'], 8] },
    overflow: () => ({ sfx: 'lose', shake: 4, stop: 120 })
  },
  stats: s => [['Routed', s.routed]],
  stars: [200, 500, 900],
  values: (s, best) => ({ score: s.score, queue: s.reqs.length, lives: hearts(s.lives), best }),
  intro: ['Queue Sorter', 'Route the request at the front: ↑ for GET (cache), → for POST (DB), ↓ for 500 errors (logs). Or tap the server.'],
  rules: [
    '<b>Route</b> the request waiting at the router with ↑ → ↓ (or W D S, or 1 2 3), the buttons, or by tapping the top, middle or bottom of the field.',
    '<b>GET</b> (green) goes to the cache, <b>POST</b> (blue) to the database, and <b>500</b> errors (red) to the logs. Each correct route is worth 10 points.',
    '<b>Wrong server</b> costs a life, and you have three.',
    '<b>Overflow:</b> requests arrive faster and faster. If more than ' + QUEUE_MAX + ' pile up in the queue, the server falls over.'],
  say(e) {
    if (e.type === 'route') return e.ok ? 'Routed. +10' : 'Wrong server! You lost a life.';
    if (e.type === 'overflow') return 'The queue overflowed!';
    return '';
  },
  end: (e, s, best) => [e.reason === 'overflow' ? 'Queue overflow!' : 'Too many wrong routes!', 'You routed ' + s.routed + (s.routed === 1 ? ' request' : ' requests') + ' for ' + e.score +
    (e.isBest && e.score > 0 ? ' points (new best!)' : ' points') + '. Best: ' + best + '.']
};
K.register(def);
})();
