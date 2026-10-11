// Catch the Fish: the pure game logic in play/game.js. Run with `node --test tests/`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, RULES, MS, GAME_MS } = require('../play/game.js');

// step until the next bite, without pressing
function untilBite(g) {
  for (let i = 0; i < 1000 && g.state.phase !== 'bite'; i++) g.step(50, false);
  assert.equal(g.state.phase, 'bite');
}

test('a press starts the round and the line goes out', () => {
  const g = createGame(1);
  assert.equal(g.state.phase, 'ready');
  assert.deepEqual(g.step(16, true), [{ type: 'start' }]);
  assert.equal(g.state.phase, 'wait');
});

test('hooking a bite scores its points and builds the combo', () => {
  const g = createGame(2); g.step(0, true);
  let caught = 0;
  for (let k = 0; k < 40 && caught < 6; k++) {
    untilBite(g);
    const fish = g.state.fish.type, before = g.state.score, mult = g.state.mult;
    const ev = g.step(16, true);
    if (fish === 'boot') { assert.equal(ev[0].type, 'boot'); assert.equal(g.state.mult, 1); continue; }
    assert.equal(ev[0].type, 'catch');
    assert.equal(g.state.score, before + RULES[fish].points * mult);
    caught++;
    for (let i = 0; i < 200 && g.state.phase !== 'wait'; i++) g.step(50, false);
  }
  assert.ok(caught >= 3, 'caught a few fish');
});

test('pressing too early is a penalty and resets the combo', () => {
  const g = createGame(3); g.step(0, true);
  const ev = g.step(16, true);
  assert.equal(ev[0].type, 'early');
  assert.equal(g.state.phase, 'penalty');
  assert.equal(g.state.mult, 1);
  g.step(MS.penalty, false);
  assert.equal(g.state.phase, 'wait');
});

test('a real bite left alone gets away; a boot left alone is the right call', () => {
  const g = createGame(4); g.step(0, true);
  let checked = 0;
  for (let k = 0; k < 8; k++, checked++) {             // as many bites as fit in the round
    untilBite(g);
    const fish = g.state.fish.type;
    const ev = g.step(RULES[fish].window, false);
    if (fish === 'boot') assert.equal(g.state.phase, 'wait');
    else { assert.equal(ev[0].type, 'miss'); assert.equal(g.state.phase, 'escape'); }
    for (let i = 0; i < 100 && g.state.phase !== 'wait'; i++) g.step(50, false);
  }
  assert.equal(checked, 8);
});

test('the round ends once, after 60 seconds', () => {
  const g = createGame(5); g.step(0, true);
  const ends = [];
  for (let t = 0; t <= GAME_MS + 1000; t += 33) ends.push(...g.step(33, false).filter(e => e.type === 'end'));
  assert.equal(ends.length, 1);
  assert.equal(g.state.phase, 'over');
  assert.deepEqual(g.step(16, true), [], 'nothing happens after the end');
});
