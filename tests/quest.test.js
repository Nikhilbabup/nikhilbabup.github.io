// Bunny Quest: levels, platformer physics, enemies, blocks, lives and the flagpole (play/games/quest.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../play/games/quest.js');
const { T, FLOOR } = Q;
const input = (held = [], presses = []) => ({ held: new Set(held), events: presses.map(a => ({ type: 'press', a })) });
function started(seed = 1, level = 0) {                       // past the level card, enemies out of the way
  const g = Q.create(seed, { level }); g.state.phase = 'play';
  g.step(1400, input());
  assert.equal(g.state.mode, 'run');
  return g;
}
const clearEnemies = s => s.L.enemies.forEach(e => { e.alive = false; });
function jumpHeight(g, hold) {
  const s = g.state, y0 = s.p.y; let top = y0;
  g.step(16, input(['jump'], ['jump']));
  for (let t = 0; t < 900; t += 16) { g.step(16, input(hold ? ['jump'] : [])); top = Math.min(top, s.p.y); }
  g.step(500, input());
  return y0 - top;
}

test('every level is well formed and its gaps and steps are within jump range', () => {
  Q.LEVELS.forEach((spec, i) => {
    const L = Q.build(i);
    assert.equal(L.tiles.length, 15); assert.equal(L.tiles[0].length, spec.cols);
    for (const col of [2, L.checkpoint, L.flag - 1]) assert.equal(L.tiles[FLOOR][col], '#', `ground at column ${col} of level ${i + 1}`);
    assert.equal(L.tiles[FLOOR - 1][L.flag], '=', 'the flagpole has a base block');
    spec.pits.forEach(([a, b]) => assert.ok(b - a + 1 <= 4 || spec.platforms.length, `pit ${a}-${b} is jumpable`));
    spec.racks.forEach(([, h]) => assert.ok(h <= 4, 'racks are at most 4 tiles tall'));
  });
});

test('physics: standing still, top speed, held vs tapped jumps, no tunnelling', () => {
  const g = started(), s = g.state;
  clearEnemies(s);
  const x0 = s.p.x; g.step(500, input());
  assert.equal(s.p.x, x0); assert.ok(s.p.ground);
  g.step(600, input(['right'])); assert.equal(s.p.vx, Q.MAX);
  s.p.x = 3 * T; s.p.vx = 0; g.step(300, input());
  const full = jumpHeight(g, true), hop = jumpHeight(g, false);
  assert.ok(full > 36 && full < 44, 'a held jump is about 5 tiles: ' + full);
  assert.ok(hop < full * 0.6, 'a tapped jump is a hop: ' + hop);
  s.p.y = 0; s.p.vy = Q.MAX_FALL;
  for (let k = 0; k < 40; k++) g.step(33, input());
  assert.ok(s.p.ground); assert.equal(s.p.y + s.p.h, FLOOR * T, 'lands on the floor even with 33 ms frames');
});

test('landing on a bug stomps it; walking into one costs a life', () => {
  const g = started(2), s = g.state;
  const e = s.L.enemies[0]; e.awake = true; e.vx = 0; e.x = s.p.x; e.y = FLOOR * T - e.h;
  s.p.y = e.y - s.p.h + 2; s.p.ground = false; s.p.vy = 0.1;
  const score = s.score; g.step(8, input());
  assert.equal(e.alive, false); assert.equal(s.score, score + 50); assert.ok(s.p.vy < 0, 'bounces');
  const e2 = s.L.enemies[1]; e2.awake = true; e2.alive = true; e2.vx = 0; s.p.vy = 0; s.p.ground = true;
  e2.x = s.p.x + 3; e2.y = s.p.y + s.p.h - e2.h;
  assert.ok(g.step(8, input()).some(x => x.type === 'die'));
  g.step(1600, input());
  assert.equal(s.lives, 2); assert.equal(s.mode, 'run'); assert.ok(s.p.inv > 0, 'blinks after respawning');
});

test('a ? block gives one carrot, then it is used', () => {
  const g = started(3), s = g.state;
  clearEnemies(s);
  s.p.x = 12 * T + 1; s.p.vx = 0;
  const carrots = s.carrots;
  jumpHeight(g, true);
  assert.equal(s.L.tiles[9][12], 'u'); assert.equal(s.carrots, carrots + 1);
  jumpHeight(g, true);
  assert.equal(s.carrots, carrots + 1);
});

test('pits, the checkpoint, the timer and game over', () => {
  const g = started(4), s = g.state;
  clearEnemies(s);
  s.p.x = s.L.checkpoint * T + 2; g.step(16, input()); assert.ok(s.cp, 'checkpoint reached');
  s.p.x = 67 * T; s.p.y = 60; s.p.vy = 0.2;
  const ev = []; for (let t = 0; t < 2400; t += 16) ev.push(...g.step(16, input()));
  assert.ok(ev.some(e => e.type === 'die' && e.why === 'pit')); assert.equal(s.lives, 2);
  assert.ok(Math.abs(s.p.x - (s.L.checkpoint * T + 1)) < 1, 'respawns at the checkpoint');
  s.timeLeft = 10;
  assert.ok(g.step(16, input()).some(e => e.type === 'die' && e.why === 'time'));
  g.step(1600, input()); assert.ok(s.timeLeft > 90000, 'the timer resets');
  s.lives = 1; s.p.y = 200;
  const end = []; for (let t = 0; t < 2000; t += 16) end.push(...g.step(16, input()));
  const overs = end.filter(e => e.type === 'over');
  assert.equal(s.phase, 'over'); assert.equal(overs.length, 1); assert.equal(overs[0].win, false);
});

test('the flagpole: height bonus, time bonus, next level, and a win after level 3', () => {
  const g = started(5), s = g.state;
  clearEnemies(s);
  s.p.x = s.L.flag * T - 8; s.p.vx = Q.MAX; s.timeLeft = 50000;
  const score = s.score, ev = [];
  for (let t = 0; t < 200 && !ev.some(e => e.type === 'flag'); t += 8) { s.p.vy = 0; s.p.y = T; ev.push(...g.step(8, input(['right']))); }
  assert.equal(ev.find(e => e.type === 'flag').bonus, 500, 'a grab near the top is worth 500');
  for (let t = 0; t < 8000 && s.level === 0; t += 16) ev.push(...g.step(16, input()));
  assert.equal(s.level, 1);
  assert.ok([500 + 250, 500 + 245].includes(s.score - score), 'plus 5 points a second left: ' + (s.score - score));
  for (const lv of [1, 2]) {
    g.step(1400, input()); clearEnemies(s);
    s.p.x = s.L.flag * T - 8; s.p.y = FLOOR * T - s.p.h; s.p.vy = 0;
    for (let t = 0; t < 12000 && s.phase === 'play' && s.level === lv; t += 16) ev.push(...g.step(16, input(['right'])));
  }
  assert.equal(s.phase, 'over'); assert.ok(s.won); assert.equal(ev.find(e => e.type === 'over').win, true);
});

test('the self-playing bot finishes all three levels', () => {
  const g = Q.create(1), s = g.state, memo = {}, held = new Set();
  s.phase = 'play';
  let queue = [];
  const act = { press: a => queue.push({ type: 'press', a }), tap: () => {}, hold: (a, on) => (on ? held.add(a) : held.delete(a)) };
  for (let t = 0; t < 300000 && s.phase === 'play'; t += 16) {
    Q.bot(s, act, memo);
    const events = queue; queue = [];
    g.step(16, { events, held });
  }
  assert.ok(s.won, `the bot reached level ${s.level + 1} with ${s.lives} lives`);
});
