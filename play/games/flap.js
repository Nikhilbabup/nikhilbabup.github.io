/* Bunny Flap: the bunny's propeller hat keeps it up, one press at a time. Fly through the gaps between server racks. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, GROUND = 112, BX = 70, BW = 7, BH = 12, RW = 18, SPACING = 118;
const GRAVITY = 0.00055, FLAP = -0.16;
const gapFor = score => Math.max(34, 48 - score * 0.6);
const speedFor = score => Math.min(0.11, 0.075 + score * 0.0015);   // px per ms

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, score: 0, y: 46, vy: 0, racks: [], untilNext: 120, lastGap: 56, flapAt: -1e9 };
  function spawn() {
    const gap = gapFor(s.score);
    let mid = s.lastGap + (rand() * 2 - 1) * 34;
    mid = K.clamp(mid, 10 + gap / 2, GROUND - 10 - gap / 2);
    s.lastGap = mid;
    s.racks.push({ x: W + 2, top: Math.round(mid - gap / 2), bot: Math.round(mid + gap / 2), passed: false });
    s.untilNext = SPACING;
  }
  function step(dt, input) {
    const ev = [];
    if (input.events.some(e => (e.type === 'press' && e.a === 'act') || (e.type === 'tap' && e.kind !== 'move'))) {
      s.vy = FLAP; s.flapAt = s.t; ev.push({ type: 'flap' });
    }
    s.t += dt;
    s.vy += GRAVITY * dt; s.y += s.vy * dt;
    if (s.y < 0) { s.y = 0; s.vy = Math.max(0, s.vy); }          // bump the top of the screen, but keep flying
    const dx = speedFor(s.score) * dt;
    s.racks.forEach(r => { r.x -= dx; });
    s.racks = s.racks.filter(r => r.x + RW > -4);
    s.untilNext -= dx;
    if (s.untilNext <= 0) spawn();
    s.racks.forEach(r => { if (!r.passed && r.x + RW < BX) { r.passed = true; s.score++; ev.push({ type: 'pass', score: s.score }); } });
    const bx = BX + 1, by = s.y + 1, bw = BW - 2, bh = BH - 2;
    const hit = s.y + BH >= GROUND || s.racks.some(r => K.overlap(bx, by, bw, bh, r.x, -10, RW, r.top + 10) || K.overlap(bx, by, bw, bh, r.x, r.bot, RW, GROUND - r.bot));
    if (hit) { s.y = Math.min(s.y, GROUND - BH); s.phase = 'over'; ev.push({ type: 'crash' }); ev.push({ type: 'over', score: s.score }); }
    return ev;
  }
  return { state: s, step };
}

// self-play: flap whenever it drops below the middle of the next gap
function bot(s, act, memo) {
  if (s.t < (memo.wait || 0)) return;
  const next = s.racks.find(r => r.x + RW > BX - 2);
  const aim = next ? (next.top + next.bot) / 2 - BH / 2 + 4 : 50;
  if (s.y > aim && s.vy > -0.03) { act.press('act'); memo.wait = s.t + 140; }
}

const def = { id: 'flap', W, H, create, bot, BX, BH, RW, GROUND, gapFor };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, text, backdrop, drawBackdrop, effects, reduced } = K;
function rack(g, x, y, h, now, capAt) {
  if (h <= 0) return;
  rect(g, x, y, RW, h, C.ink);
  rect(g, x + 1, y, RW - 2, h, C.steel);
  for (let yy = y + 3; yy < y + h - 1; yy += 6) {
    rect(g, x + 2, yy, RW - 4, 1, C.steelL);
    const on = reduced || Math.floor(now / 250 + yy * 0.37 + x * 0.05) % 3 !== 0;
    rect(g, x + RW - 5, yy + 2, 1, 1, on ? C.green : '#2a3532');
    rect(g, x + RW - 3, yy + 2, 1, 1, on && yy % 12 ? C.gold : '#2a3532');
  }
  rect(g, x - 1, capAt, RW + 2, 3, C.ink); rect(g, x, capAt + 1, RW, 1, C.steelL);   // the lip at the gap
}
def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, GROUND), fx = effects();
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      drawBackdrop(g, b, W, now);
      s.racks.forEach(r => {
        const x = Math.round(r.x);
        rack(g, x, 0, r.top, now, r.top - 3);
        rack(g, x, r.bot, GROUND - r.bot, now, r.bot);
      });
      // the bunny, bobbing on the ready screen, with a spinning propeller hat
      const bob = s.phase === 'ready' && !reduced ? Math.round(Math.sin(now / 260) * 2) : 0;
      const y = Math.round(s.y) + bob, over = s.phase === 'over';
      sprite(g, s.vy < 0 && !over ? SPR.bunnyAir : SPR.bunny, BX, y, { flip: true, outline: C.outline, pal: over ? { k: C.outline } : null });
      const spin = over ? 0 : Math.floor(now / (s.t - s.flapAt < 200 ? 40 : 90)) % 2;
      rect(g, BX + 4, y - 2, 1, 2, C.ink);
      if (spin) rect(g, BX + 1, y - 3, 7, 1, C.red); else rect(g, BX + 3, y - 3, 3, 1, C.redD);
      if (s.phase === 'play') text(g, s.score, W / 2, 6, C.cream, { align: 'center', scale: 2 });
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'pass') fx.sparkle(BX + 3, Math.round(s.y) + 5, C.gold, now);
      if (e.type === 'crash') fx.splat(BX + 3, Math.round(s.y) + 6, C.red, now);
    },
    clear: () => fx.clear()
  };
};

def.ui = {
  title: 'Bunny Flap', lead: 'The bunny’s propeller hat only spins when you press. Keep it airborne and thread it between the server racks.',
  keys: 'Space / ↑ / tap', tap: true,
  keymap: { Space: 'act', Enter: 'act', ArrowUp: 'act', KeyW: 'act' },
  pad: [['act', 'Flap!', 'or press Space / ↑']],
  hud: [['score', 'Racks'], ['best', 'Best']],
  values: (s, best) => ({ score: s.score, best }),
  intro: ['Bunny Flap', 'Press Space, ↑ or tap to flap. Fly through the gaps between the server racks; don’t touch the racks or the ground.'],
  rules: [
    '<b>Flap</b> with Space, Enter, ↑, a click or a tap. Each press gives the bunny a little lift; gravity does the rest.',
    '<b>Racks:</b> every rack you get past is worth 1 point.',
    '<b>Crashing</b> into a server rack or the ground ends the flight. Bumping the top of the screen is fine.',
    'The gaps get narrower and the racks come faster as your score climbs.'],
  say(e) { return e.type === 'pass' ? 'Rack ' + e.score + '!' : e.type === 'crash' ? 'Crash!' : ''; },
  end: (e, s, best) => ['Crash!', 'You flew past ' + e.score + (e.score === 1 ? ' rack' : ' racks') + (e.isBest && e.score > 0 ? ' (new best!)' : '') + '. Best: ' + best + '.']
};
K.register(def);
})();
