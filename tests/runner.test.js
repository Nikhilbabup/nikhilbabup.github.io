// Bug Runner: the pure game logic in play/runner.js, including the banner intro the PoultryPro page uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunner, AIR_MS, JUMP_V, GRAVITY, SPEED_MIN, SPEED_MAX } = require('../play/runner.js');

test('starts on the first press and speeds up over time, up to a cap', () => {
  const r = createRunner(1);
  assert.equal(r.state.phase, 'ready');
  r.step(16, true);
  assert.equal(r.state.phase, 'run');
  r.state.obstacles = []; r.state.untilNext = Infinity;
  for (let t = 0; t < 200000; t += 33) { r.step(33, false); r.state.obstacles = []; }
  assert.ok(r.state.speed > SPEED_MIN && r.state.speed <= SPEED_MAX);
});

test('a jump rises about 18px and lands after the expected air time', () => {
  const r = createRunner(2); r.step(0, true);
  r.state.untilNext = Infinity;
  r.step(16, true);
  let top = 0, t = 0, landed = false;
  while (t < 2000 && !landed) { const ev = r.step(4, false); t += 4; top = Math.max(top, r.state.y); landed = ev.some(e => e.type === 'land'); }
  assert.ok(Math.abs(top - (JUMP_V * JUMP_V) / (2 * GRAVITY)) < 1, 'peak height ' + top);
  assert.ok(Math.abs(t - AIR_MS) < 40, 'air time ' + t);
});

test('a 0 ms frame never cancels a jump', () => {
  const r = createRunner(3); r.step(0, true);
  r.state.untilNext = Infinity;
  r.step(16, true);
  r.step(0, false);
  assert.ok(r.state.y > 0 || r.state.vy > 0, 'still in the air');
});

test('running into a bug ends the run once, with the score', () => {
  const r = createRunner(4); r.step(0, true);
  r.state.untilNext = Infinity;
  r.state.obstacles = [{ kind: 'bug', x: r.state.bx + 20, w: 8, h: 6, y: 0 }];
  let hits = [];
  for (let t = 0; t < 3000 && r.state.phase === 'run'; t += 16) hits.push(...r.step(16, false).filter(e => e.type === 'hit'));
  assert.equal(hits.length, 1);
  assert.equal(r.state.phase, 'over');
  assert.equal(hits[0].score, r.state.score);
});

test('collecting a commit is worth 10 points', () => {
  const r = createRunner(5); r.step(0, true);
  r.state.untilNext = Infinity;
  r.state.commits = [{ x: r.state.bx + 3, y: 2 }];
  const before = r.state.collected;
  r.step(16, false);
  assert.equal(r.state.collected, before + 1);
});

test('the banner intro: the bunny sprints from where it stood to its running spot', () => {
  const r = createRunner(6, { width: 320, height: 120, ground: 108, bunnyFrom: 100, bunnyX: 120, startDist: -320, accelMs: 800, introJump: true, firstGap: 150 });
  assert.equal(r.state.bx, 100);
  const ev = r.step(0, true);
  assert.ok(ev.some(e => e.type === 'jump'), 'the first press also hops');
  for (let t = 0; t < 1000; t += 16) r.step(16, false);
  assert.equal(Math.round(r.state.bx), 120);
  assert.ok(r.state.dist > -320, 'the camera has moved off the farm');
});
