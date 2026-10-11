/* Deploy Pipeline: a marker sweeps across a meter; press when it's inside the green window to pass each stage
   (lint, test, build, deploy). Ship all four for a release bonus. The window narrows and the marker speeds up;
   three missed stages break the build. */
(() => {
const K = typeof module !== 'undefined' ? require('../kit.js') : window.Arcade;
const W = 320, H = 120, GROUND = 110, STAGES = ['LINT', 'TEST', 'BUILD', 'DEPLOY'], LIVES = 3;
const BAR_X = 40, BAR_W = 240, BAR_Y = 56;
const stageX = i => 24 + i * 72;            // each stage box is 56 wide
const windowWidth = level => Math.max(14, 60 - level * 3);
const markerSpeed = level => Math.min(0.42, 0.12 + level * 0.012);   // px per ms

function create(seed = 1) {
  const rand = K.rng(seed);
  const s = { phase: 'ready', t: 0, score: 0, lives: LIVES, stage: 0, releases: 0, level: 0, pos: BAR_X, dir: 1,
              win: null, results: [null, null, null, null], judgedAt: -1e9, shippedAt: -1e9, stageAt: 0 };
  function newWindow() {
    const w = windowWidth(s.level);
    let x = BAR_X + rand() * (BAR_W - w);
    if (Math.abs(x + w / 2 - s.pos) < 30) x = BAR_X + ((x - BAR_X + BAR_W / 2) % (BAR_W - w));   // not right under the marker
    s.win = { x, w };
  }
  newWindow();

  function judge(ev) {
    s.judgedAt = s.t;
    const { x, w } = s.win;
    if (s.pos >= x && s.pos <= x + w) {
      const perfect = Math.abs(s.pos - (x + w / 2)) <= Math.max(2, w / 6), points = perfect ? 25 : 10;
      s.score += points; s.results[s.stage] = 'ok'; s.level++;
      ev.push({ type: 'pass', stage: s.stage, perfect, points });
      s.stage++; s.stageAt = s.t;
      if (s.stage === STAGES.length) {
        s.releases++; s.score += 50; s.shippedAt = s.t;
        ev.push({ type: 'ship', points: 50, releases: s.releases });
        s.stage = 0; s.results = [null, null, null, null];
      }
    } else {
      s.lives--; s.results[s.stage] = 'fail';
      ev.push({ type: 'fail', stage: s.stage });
      if (s.lives <= 0) { s.phase = 'over'; ev.push({ type: 'over', score: s.score }); return; }
    }
    newWindow();
  }

  function step(dt, input) {
    const ev = [];
    s.t += dt;
    s.pos += s.dir * markerSpeed(s.level) * dt;
    if (s.pos > BAR_X + BAR_W) { s.pos = 2 * (BAR_X + BAR_W) - s.pos; s.dir = -1; }
    if (s.pos < BAR_X) { s.pos = 2 * BAR_X - s.pos; s.dir = 1; }
    if (s.results[s.stage] === 'fail' && s.t - s.judgedAt > 500) s.results[s.stage] = null;
    for (const e of input.events) {
      if ((e.type === 'press' && e.a === 'act') || (e.type === 'tap' && e.kind !== 'move')) { judge(ev); if (s.phase === 'over') break; }
    }
    return ev;
  }
  return { state: s, step };
}

// self-play: press when the marker is near the middle of the window
function bot(s, act, memo) {
  if (s.t < (memo.wait || 0)) return;
  const mid = s.win.x + s.win.w / 2;
  if (Math.abs(s.pos - mid) <= s.win.w / 4) { act.press('act'); memo.wait = s.t + 250; }
}

const def = { id: 'deploy', W, H, create, bot, consumeStart: true, BAR_X, BAR_W, windowWidth, markerSpeed };
if (typeof module !== 'undefined') { module.exports = def; return; }

/* ---------- drawing ---------- */
const { C, rect, sprite, SPR, text, backdrop, drawBackdrop, effects, reduced } = K;
const box = (g, x, y, w, h, fill, edge) => { rect(g, x, y, w, h, edge); rect(g, x + 1, y + 1, w - 2, h - 2, fill); };
def.renderer = cv => {
  const g = cv.getContext('2d'), b = backdrop(W, H, GROUND), fx = effects();
  let bunnyX = stageX(0) + 22;
  return {
    render(s, now) {
      g.clearRect(0, 0, W, H);
      drawBackdrop(g, b, W, now);
      // the pipeline: four stages joined by a pipe
      rect(g, stageX(0) + 28, 19, stageX(3) - stageX(0), 2, '#9fb8ab');
      const shipped = s.t - s.shippedAt < 700;
      STAGES.forEach((name, i) => {
        const x = stageX(i), res = s.results[i];
        const current = i === s.stage && s.phase !== 'over';
        let fill = C.cream, edge = '#9fb8ab', ink = C.ink;
        if (res === 'ok' || shipped) { fill = C.green; edge = C.greenD; ink = '#ffffff'; }
        else if (res === 'fail') { fill = C.red; edge = C.redD; ink = '#ffffff'; }
        else if (current) edge = reduced || Math.floor(now / 300) % 2 ? C.red : C.redD;
        if (current && !res) rect(g, x - 1, 9, 58, 21, edge);   // a thicker border on the stage you're on
        box(g, x, 10, 56, 19, fill, edge);
        text(g, name, x + 28, 17, ink, { align: 'center' });
      });
      // the meter
      box(g, BAR_X - 2, BAR_Y - 2, BAR_W + 4, 14, '#e9efe9', C.ink);
      const { x, w } = s.win, core = Math.max(4, w / 3);
      rect(g, x, BAR_Y, w, 10, C.green);
      rect(g, x + w / 2 - core / 2, BAR_Y, core, 10, C.greenD);
      const mx = Math.round(s.pos);
      rect(g, mx - 1, BAR_Y - 5, 3, 20, C.red); rect(g, mx - 2, BAR_Y - 6, 5, 2, C.red); rect(g, mx - 2, BAR_Y + 14, 5, 2, C.red);
      // the bunny walks to the stage it's shipping, carrying the build
      const target = stageX(s.stage) + 22;
      bunnyX += (target - bunnyX) * 0.12;
      if (Math.abs(target - bunnyX) < 0.5) bunnyX = target;
      const walking = Math.abs(target - bunnyX) > 0.5, bx = Math.round(bunnyX);
      sprite(g, walking ? SPR.bunnyRun[Math.floor(now / 110) % 2] : SPR.bunny, bx, GROUND - 12, { flip: target >= bunnyX, outline: C.outline, pal: s.phase === 'over' ? { k: C.outline } : null });
      box(g, bx + 1, GROUND - 18, 6, 5, C.gold, C.trunk);
      text(g, 'V' + (s.releases + 1) + '.0', W - 8, GROUND + 3, C.cream, { align: 'right' });
      if (shipped) text(g, 'SHIPPED!', W / 2, 36, C.greenD, { align: 'center', scale: 2 });
      fx.draw(g, now);
    },
    event(e, s, now) {
      if (e.type === 'pass') fx.float(Math.round(s.pos), BAR_Y - 8, e.perfect ? 'PERFECT +25' : '+10', C.greenD, now);
      if (e.type === 'fail') fx.float(Math.round(s.pos), BAR_Y - 8, 'FAILED', C.redD, now);
    },
    clear: () => { fx.clear(); bunnyX = stageX(0) + 22; }
  };
};

const hearts = n => '♥'.repeat(n) + '♡'.repeat(LIVES - n);
def.ui = {
  title: 'Deploy Pipeline', lead: 'Get the build through lint, test, build and deploy. Press when the marker is in the green window: miss three times and the build breaks.',
  keys: 'Space / Enter / tap', tap: true,
  keymap: { Space: 'act', Enter: 'act', ArrowUp: 'act' },
  hud: [['score', 'Score'], ['releases', 'Releases'], ['lives', 'Lives'], ['best', 'Best']],
  values: (s, best) => ({ score: s.score, releases: s.releases, lives: hearts(s.lives), best }),
  intro: ['Deploy Pipeline', 'Press Space, Enter or tap when the red marker is inside the green window. Pass all four stages to ship a release.'],
  rules: [
    '<b>Press</b> Space, Enter or tap while the red marker is inside the green window to pass the current stage.',
    '<b>Points:</b> 10 for a pass, 25 for a <b>perfect</b> hit in the dark green middle, and a 50-point bonus for every release you ship.',
    '<b>Each stage</b> you pass makes the window narrower and the marker faster.',
    '<b>Missing</b> the window fails the stage and costs a life. Three failures and the build is broken.'],
  say(e) {
    if (e.type === 'pass') return (e.perfect ? 'Perfect! ' : 'Passed. ') + '+' + e.points;
    if (e.type === 'ship') return 'Shipped release ' + e.releases + '! +50';
    if (e.type === 'fail') return 'Stage failed. You lost a life.';
    return '';
  },
  end: (e, s, best) => ['Build broken!', 'You shipped ' + s.releases + (s.releases === 1 ? ' release' : ' releases') + ' and scored ' + e.score +
    (e.isBest && e.score > 0 ? ' (new best!)' : '') + '. Best: ' + best + '.']
};
K.register(def);
})();
