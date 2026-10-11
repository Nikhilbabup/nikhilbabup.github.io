// The kit games in play/games/: rules for each, plus a self-play smoke test for all of them.
const test = require('node:test');
const assert = require('node:assert/strict');
const load = name => require('../play/games/' + name + '.js');
const NAMES = ['carrots', 'eggs', 'deploy', 'snake', 'memory', 'flap', 'queue'];
const input = (events = [], held = []) => ({ events, held: new Set(held) });
const press = a => ({ type: 'press', a });
const tap = (x, y, kind = 'down') => ({ type: 'tap', x, y, kind });
const playing = (def, seed = 1) => { const g = def.create(seed); g.state.phase = 'play'; return g; };

// what play/kit.js mount() does each frame: the bot acts, then the game steps
function selfPlay(def, seed, ms) {
  const g = playing(def, seed), memo = {}, held = new Set(), events = [];
  let queue = [];
  const act = { press: a => queue.push(press(a)), tap: (x, y, kind) => queue.push(tap(x, y, kind)), hold: (a, on) => (on ? held.add(a) : held.delete(a)) };
  for (let t = 0; t < ms && g.state.phase === 'play'; t += 16) {
    def.bot(g.state, act, memo);
    const inp = queue; queue = [];
    events.push(...g.step(16, { events: inp, held }));
  }
  return { s: g.state, events };
}

test('every game plays itself for 3 minutes: one game over at most, with a sane score', () => {
  for (const name of NAMES) {
    const def = load(name);
    assert.equal(def.id, name);
    for (let seed = 1; seed <= 3; seed++) {
      const { s, events } = selfPlay(def, seed, 180000);
      const overs = events.filter(e => e.type === 'over');
      assert.ok(overs.length <= 1, name + ': at most one game over');
      if (overs.length) assert.equal(overs[0].score, s.score, name + ': the over event carries the score');
      assert.ok(Number.isFinite(s.score) && s.score >= 0, name + ': score ' + s.score);
    }
  }
});

test('Carrot Harvest: pulls, golden carrots, bugs and a 45 second round', () => {
  const C = load('carrots'), g = playing(C), s = g.state;
  assert.ok(g.step(16, input([tap(C.holeX(0), 96)])).some(e => e.type === 'whiff'), 'pulling an empty hole is a whiff');
  s.pops = [{ hole: 3, kind: 'golden', age: 100, life: 900 }];
  g.step(16, input([press('h3')])); assert.equal(s.score, 3);
  s.pops = [{ hole: 1, kind: 'bug', age: 100, life: 900 }];
  g.step(16, input([tap(C.holeX(1) + 10, 50)])); assert.equal(s.score, 1, 'a bug costs 2');
  let t = 0; while (s.phase === 'play') { g.step(33, input()); t += 33; }
  assert.ok(Math.abs(t - 45000) < 100);
});

test('Egg Catch: moving, catching, splats and rotten eggs', () => {
  const E = load('eggs'), g = playing(E, 2), s = g.state;
  g.step(1000, input([], ['right'])); assert.equal(s.x, 308, 'held right runs to the edge');
  s.untilNext = Infinity; s.x = 100;
  s.eggs = [{ x: 100, y: E.CATCH_Y - 1, vy: 0.05, g: 0, kind: 'golden' }]; g.step(40, input()); assert.equal(s.score, 5);
  s.eggs = [{ x: 200, y: 100, vy: 0.05, g: 0, kind: 'egg' }]; g.step(200, input()); assert.equal(s.lives, 2, 'a dropped egg costs a life');
  s.eggs = [{ x: 100, y: E.CATCH_Y - 1, vy: 0.05, g: 0, kind: 'rotten' }]; g.step(40, input()); assert.equal(s.lives, 1, 'catching a rotten egg costs a life');
  s.eggs = [{ x: 200, y: 100, vy: 0.05, g: 0, kind: 'rotten' }]; g.step(200, input()); assert.equal(s.lives, 1, 'dropping a rotten egg is free');
  g.step(10, input([tap(40, 50, 'move')])); assert.equal(s.target, 40, 'dragging sets where to go');
});

test('Deploy Pipeline: perfect hits, the release bonus and three failures', () => {
  const D = load('deploy'), g = playing(D, 3), s = g.state;
  s.pos = s.win.x + s.win.w / 2;
  assert.ok(g.step(0, input([press('act')])).some(e => e.type === 'pass' && e.perfect));
  assert.equal(s.score, 25);
  for (let i = 0; i < 3; i++) { s.pos = s.win.x + 1; g.step(0, input([press('act')])); }
  assert.equal(s.releases, 1); assert.equal(s.score, 25 + 30 + 50);
  for (let i = 0; i < 3; i++) { s.pos = s.win.x > 100 ? D.BAR_X : D.BAR_X + D.BAR_W; g.step(0, input([press('act')])); }
  assert.equal(s.phase, 'over');
  assert.equal(D.windowWidth(100), 14); assert.equal(D.markerSpeed(100), 0.42);
});

test('Bunny Hop: turning, eating, growing and crashing', () => {
  const S = load('snake'), g = playing(S, 4), s = g.state;
  g.step(0, input([press('left')])); assert.equal(s.queue.length, 0, 'no reversing into yourself');
  s.carrot = { x: 7, y: 7 }; g.step(150, input()); assert.equal(s.score, 1); assert.equal(s.body.length, 4);
  g.step(0, input([tap(8 * 8 + 4, 0)])); assert.equal(s.queue[0], 'up', 'a tap above turns up');
  const g2 = playing(S, 5); g2.state.carrot = { x: 0, y: 0 };
  const ev = []; for (let i = 0; i < 60 && g2.state.phase === 'play'; i++) ev.push(...g2.step(150, input()));
  assert.ok(ev.some(e => e.type === 'crash'), 'running into the fence ends it');
});

test('Memory Match: hit-testing, a perfect game and a miss', () => {
  const M = load('memory');
  const centre = i => [M.X0 + (i % 8) * (M.CW + M.GAP) + M.CW / 2, M.Y0 + Math.floor(i / 8) * (M.CH + M.GAP) + M.CH / 2];
  for (let i = 0; i < 16; i++) assert.equal(M.cardAt(...centre(i)), i);
  const g = playing(M, 6), s = g.state, byIcon = {};
  s.cards.forEach((c, i) => (byIcon[c.icon] = byIcon[c.icon] || []).push(i));
  const ev = [];
  Object.values(byIcon).forEach(([a, b]) => ev.push(...g.step(500, input([tap(...centre(a)), tap(...centre(b))]))));
  assert.equal(s.phase, 'over'); assert.equal(s.moves, 8);
  assert.equal(ev.find(e => e.type === 'over').score, M.scoreFor(8, 4000));
  const g2 = playing(M, 7), c2 = g2.state.cards, other = c2.findIndex((c, i) => i > 0 && c.icon !== c2[0].icon);
  g2.step(10, input([tap(...centre(0)), tap(...centre(other))]));
  assert.equal(g2.state.open.length, 2);
  g2.step(900, input()); assert.equal(g2.state.open.length, 0, 'a miss flips back');
});

test('Bunny Flap: gravity wins without flapping; a flap goes up', () => {
  const F = load('flap'), g = playing(F, 8);
  for (let t = 0; t < 5000 && g.state.phase === 'play'; t += 16) g.step(16, input());
  assert.equal(g.state.phase, 'over'); assert.equal(g.state.score, 0);
  const g2 = playing(F, 8); g2.step(16, input([press('act')])); assert.ok(g2.state.vy < 0);
});

test('Queue Sorter: right server, wrong server, waiting and overflow', () => {
  const Q = load('queue'), g = playing(Q, 9), s = g.state;
  s.untilNext = Infinity;
  s.reqs = [{ type: 'post', x: Q.FRONT_X }]; g.step(0, input([press('mid')])); assert.equal(s.score, 10);
  s.reqs = [{ type: 'err', x: Q.FRONT_X }]; g.step(0, input([tap(100, 20)])); assert.equal(s.lives, 2);
  s.reqs = [{ type: 'get', x: 10 }]; g.step(0, input([press('top')])); assert.equal(s.reqs.length, 1, 'only the request at the router can be routed');
  const g2 = playing(Q, 10);
  while (g2.state.phase === 'play') g2.step(33, input());
  assert.equal(g2.state.reqs.length, Q.QUEUE_MAX + 1);
});
