/* Bunny Arcade: every mini-game on one page. The grid shows each game playing itself;
   pick one and it opens right here (arcade.html#fish, #runner, #carrots, ...), with its own scoreboard, controls and rules.
   Needs play/game.js (window.FishGame), play/runner.js (window.BugRunner), play/kit.js (window.Arcade) and play/games/*.js. */
(() => {
const $ = id => document.getElementById(id);
const grid = $('grid'), view = $('view'), field = $('field'), overlay = $('overlay'), pad = $('pad');
const el = { eyebrow: $('eyebrow'), heading: $('heading'), lead: $('lead'), hud: $('hud'), keys: $('keys'), rules: $('rules'),
  title: $('overlayTitle'), text: $('overlayText'), status: $('status') };
const home = { eyebrow: el.eyebrow.textContent, heading: el.heading.textContent, lead: el.lead.textContent, title: document.title };
const say = msg => { el.status.textContent = msg; };
const showOverlay = (title, text) => { el.title.textContent = title; el.text.textContent = text; overlay.hidden = false; };
const toMap = (codes, a = 'act') => Object.fromEntries(codes.map(c => [c, a]));

/* Each game: title, lead, keys (hint), keymap { code: action }, pad [[action, label, small?]], tap / drag / swipe (pointer
   handling on the field), hud, values, intro, rules, bestKey, mount, onEvent, demo (preview opts), demoStart. */
const GAMES = {
  fish: {
    title: 'Catch the Fish', lead: 'The bunny has been fishing all day. Hook each bite the moment you see the “!”, and beat your best in 60 seconds.',
    keys: 'Space / Enter / tap', keymap: toMap(['Space', 'Enter']), pad: [['act', 'Hook it!', 'or press Space / Enter']], bestKey: 'fishBest',
    hud: [['score', 'Score'], ['time', 'Time', 's'], ['mult', 'Combo'], ['best', 'Best']],
    values: (s, best) => ({ score: s.score, time: Math.ceil(s.timeLeft / 1000), mult: '×' + s.mult, best }),
    intro: ['Catch the fish', 'Press Space, Enter or tap to cast. Hook each bite the moment you see the “!”. 60 seconds.'],
    rules: [
      '<b>Wait</b> for the red “!” and the bobber to dip, then hook it. One button does everything.',
      '<b>Common fish</b> are worth 1 point. <b>Golden fish</b> (gold “!”) are worth 3 but give you less time to react.',
      '<b>Old boots</b> bite without a “!”. Leave them alone: hooking one costs a point.',
      '<b>Too early</b> scares the fish and costs you a second. <b>Combo:</b> every 3 catches in a row raises your multiplier, up to ×3.'],
    mount: (cv, opts) => FishGame.mount(cv, opts),
    onEvent(e, s, best) {
      switch (e.type) {
        case 'start': overlay.hidden = true; say('Go!'); break;
        case 'bite': if (e.fish !== 'boot') say(e.fish === 'golden' ? 'Golden bite!' : 'Bite!'); break;
        case 'catch': say((e.fish === 'golden' ? 'Golden fish! ' : 'Caught a fish. ') + '+' + e.points); break;
        case 'boot': say('An old boot. Minus one.'); break;
        case 'miss': say('It got away.'); break;
        case 'early': say('Too early. The fish got spooked.'); break;
        case 'end':
          showOverlay("Time's up!", 'You scored ' + e.score + (e.isBest && e.score > 0 ? ' (new best!)' : '') + '. Best: ' + best + '. Press Enter or tap to play again.');
          say("Time's up. You scored " + e.score + '.');
          break;
        default: break;
      }
    },
    // the card preview plays itself: it hooks every real bite and starts a new round when time runs out
    demo: ctl => ({
      onEvent(e) {
        if (e.type === 'bite' && e.fish !== 'boot') setTimeout(() => ctl().press(), 260);
        if (e.type === 'end') setTimeout(() => ctl().press(), 1500);
      }
    }),
    demoStart: ctl => ctl.start({ cast: true })
  },
  runner: {
    title: 'Bug Runner', lead: 'Ship it before the bugs catch you. Jump the bugs, grab the commits, and see how far the bunny can run.',
    keys: 'Space / ↑ / tap', keymap: toMap(['Space', 'Enter', 'ArrowUp', 'KeyW']), pad: [['act', 'Jump!', 'or press Space / ↑']], bestKey: 'runnerBest',
    hud: [['score', 'Score'], ['commits', 'Commits'], ['best', 'Best']],
    values: (s, best) => ({ score: s.score, commits: s.collected, best }),
    intro: ['Bug Runner', 'Press Space, ↑ or tap to jump. Hop over the bugs, grab the commits, and stay low under the flying bugs.'],
    rules: [
      '<b>Jump</b> with Space, Enter, ↑, a click or a tap. The bunny runs on its own and keeps getting faster.',
      '<b>Bugs</b> crawl along the ground. Jump over them; the taller <b>bug stacks</b> need a well-timed jump.',
      '<b>Flying bugs</b> buzz at head height. Stay on the ground and run under them.',
      '<b>Commits</b> are worth 10 points each. Some float high, so you’ll have to jump for them. One hit ends the run.'],
    mount: (cv, opts) => BugRunner.mount(cv, opts),
    onEvent(e, s, best) {
      if (e.type === 'start') { overlay.hidden = true; say('Running!'); }
      else if (e.type === 'commit') say('Commit +10');
      else if (e.type === 'hit') {
        showOverlay('Bug hit!', 'You scored ' + e.score + (e.isBest && e.score > 0 ? ' (new best!)' : '') + ' with ' + s.collected +
          (s.collected === 1 ? ' commit' : ' commits') + '. Best: ' + best + '. Press Enter or tap to run again.');
        say('Hit a bug. You scored ' + e.score + '.');
      }
    },
    // the card preview plays itself: it jumps ground bugs and runs again after a hit
    demo: ctl => ({
      onFrame(s) {
        const next = s.obstacles.filter(o => o.x + o.w > s.bx).sort((a, b) => a.x - b.x)[0];
        const lead = next ? next.x - (s.bx + 7) : Infinity;
        if (next && next.kind !== 'fly' && lead > 0 && lead <= s.speed * 120) ctl().press();
      },
      onEvent(e) { if (e.type === 'hit') setTimeout(() => ctl().press(), 900); }
    }),
    demoStart: ctl => ctl.start({ run: true })
  }
};

// the kit games (play/games/*.js) describe themselves in def.ui
Arcade.order.forEach(id => {
  const def = Arcade.defs[id], u = def.ui;
  GAMES[id] = {
    ...u, bestKey: id + 'Best',
    mount: (cv, opts) => Arcade.mount(cv, def, opts),
    onEvent(e, s, best) {
      if (e.type === 'start') { overlay.hidden = true; say('Go!'); }
      else if (e.type === 'over') {
        const [title, text] = u.end(e, s, best);
        showOverlay(title, text + ' Press Enter or tap to play again.');
        say(title + ' ' + text);
      } else { const m = u.say && u.say(e, s); if (m) say(m); }
    },
    demo: () => ({ autoplay: true }),
    demoStart: ctl => ctl.start({ auto: true })
  };
});

/* ---------- live previews on the cards ---------- */
const previews = {};
document.querySelectorAll('[data-preview]').forEach(cv => {
  const id = cv.dataset.preview, G = GAMES[id];
  if (!G) return;
  let ctl = null;
  ctl = G.mount(cv, { saveBest: false, ...G.demo(() => ctl) });
  previews[id] = ctl;
});
const startPreviews = () => Object.keys(previews).forEach(id => GAMES[id].demoStart(previews[id]));
const stopPreviews = () => Object.values(previews).forEach(p => p.stop());

/* ---------- the single-game view ---------- */
const games = {}, canvases = {};
let active = null, shown = {};
const ctl = () => games[active];

function readBest(id) {
  if (games[id]) return games[id].best;
  try { return +localStorage.getItem(GAMES[id].bestKey) || 0; } catch (e) { return 0; }
}
const refreshBest = () => document.querySelectorAll('[data-best]').forEach(b => { if (GAMES[b.dataset.best]) b.textContent = readBest(b.dataset.best); });

function canvasFor(id) {
  if (!canvases[id]) {
    const cv = document.createElement('canvas');
    cv.tabIndex = -1;
    cv.setAttribute('aria-label', GAMES[id].title + '. ' + GAMES[id].intro[1]);
    field.insertBefore(cv, overlay);
    canvases[id] = cv;
  }
  return canvases[id];
}
const showValues = v => Object.keys(v).forEach(k => {
  if (shown[k] === v[k]) return;
  shown[k] = v[k];
  const b = el.hud.querySelector('[data-k="' + k + '"]'); if (b) b.textContent = v[k];
});

function open(id) {
  const G = GAMES[id];
  if (active === id) return;
  if (active) ctl().stop();
  active = id; shown = {};
  stopPreviews();
  Object.keys(canvases).forEach(k => { canvases[k].hidden = k !== id; });
  const cv = canvasFor(id);
  cv.hidden = false;
  el.hud.innerHTML = G.hud.map(([k, label, unit]) => '<span>' + label + ' <b data-k="' + k + '">0</b>' + (unit || '') + '</span>').join('');
  el.rules.innerHTML = G.rules.map(r => '<li>' + r + '</li>').join('');
  el.keys.textContent = G.keys + ' · F full screen · Esc for all games';
  pad.innerHTML = G.pad.map(([a, label, small]) => '<button class="hook" type="button" data-a="' + a + '">' + label + (small ? '<small>' + small + '</small>' : '') + '</button>').join('');
  pad.hidden = !G.pad.length;
  pad.classList.toggle('multi', G.pad.length > 1);
  field.style.touchAction = G.swipe || G.drag ? 'none' : '';
  el.eyebrow.textContent = 'Bunny Arcade'; el.heading.textContent = G.title; el.lead.textContent = G.lead;
  document.title = G.title + ' · Bunny Arcade';
  if (!games[id]) games[id] = G.mount(cv, {
    onFrame: (s, best) => showValues(G.values(s, best)),
    onEvent: (e, s, best) => { if (e.type === 'start') shown = {}; G.onEvent(e, s, best); }
  });
  else games[id].reset();
  showValues(G.values(games[id].state, games[id].best));    // real starting values (60s, ×1, best) right away
  showOverlay(G.intro[0], G.intro[1]);
  games[id].start();
  grid.hidden = true; view.hidden = false; document.body.classList.add('in-game');
  scrollTo({ top: 0 });
  cv.focus({ preventScroll: true });
}

function showGrid() {
  const was = active;
  if (isFull()) exitFull();
  if (active) { ctl().stop(); active = null; }
  view.hidden = true; grid.hidden = false; document.body.classList.remove('in-game');
  el.eyebrow.textContent = home.eyebrow; el.heading.textContent = home.heading; el.lead.textContent = home.lead;
  document.title = home.title;
  refreshBest();
  startPreviews();
  if (was) { const card = grid.querySelector('[data-game="' + was + '"]'); if (card) card.focus({ preventScroll: true }); }
}

const route = () => { const id = location.hash.slice(1); if (GAMES[id]) open(id); else showGrid(); };
const toGrid = () => { history.pushState(null, '', location.pathname + location.search); route(); };

/* ---------- full screen ---------- */
// the real Fullscreen API where there is one; otherwise (iPhone Safari) the stage just covers the window
const stage = $('stage'), fullBtn = $('fullBtn');
const canFull = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
const isFull = () => stage.classList.contains('is-full');
function setFull(on) {
  stage.classList.toggle('is-full', on);
  document.body.classList.toggle('fake-full', on && !(document.fullscreenElement || document.webkitFullscreenElement));
  fullBtn.setAttribute('aria-pressed', String(on));
  fullBtn.querySelector('span').textContent = on ? 'Exit full screen' : 'Full screen';
  fullBtn.title = (on ? 'Exit full screen' : 'Full screen') + ' (F)';
  if (active) canvases[active].focus({ preventScroll: true });
}
function enterFull() {
  if (canFull) {
    const req = stage.requestFullscreen ? stage.requestFullscreen({ navigationUI: 'hide' }) : stage.webkitRequestFullscreen();
    if (req && req.catch) req.catch(() => setFull(true));        // refused: fall back to covering the window
    try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ }
  }
  setFull(true);
}
function exitFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
  setFull(false);
}
const toggleFull = () => (isFull() ? exitFull() : enterFull());
['fullscreenchange', 'webkitfullscreenchange'].forEach(t => document.addEventListener(t, () => {
  if (!(document.fullscreenElement || document.webkitFullscreenElement) && isFull() && !document.body.classList.contains('fake-full')) setFull(false);
}));
fullBtn.addEventListener('click', toggleFull);

/* ---------- input ---------- */
const press = a => { if (active) ctl().press(a); };
const release = a => { if (active && ctl().release) ctl().release(a); };
function toCanvas(e) {
  const cv = canvases[active], r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
}
let swipe = null, dragging = null;
field.addEventListener('pointerdown', e => {
  if (!active) return;
  e.preventDefault();
  const G = GAMES[active];
  if (G.swipe) { swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }   // decided on release: a swipe or a tap
  if (G.tap) { const p = toCanvas(e); ctl().tap(p.x, p.y); if (G.drag) dragging = e.pointerId; }
  else press('act');
});
field.addEventListener('pointermove', e => {
  if (active && dragging === e.pointerId) { const p = toCanvas(e); ctl().tap(p.x, p.y, 'move'); }
});
addEventListener('pointerup', e => {
  if (active && swipe && swipe.id === e.pointerId) {
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) > 24) press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    else { const p = toCanvas(e); ctl().tap(p.x, p.y); }
  }
  swipe = null; dragging = null;
});
addEventListener('pointercancel', () => { swipe = null; dragging = null; });

// the control pad: hold-to-move buttons send a press on the way down and a release on the way up
pad.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-a]'); if (!b || !active) return;
  e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* not an active pointer */ } press(b.dataset.a);
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => pad.addEventListener(t, e => {
  const b = e.target.closest('[data-a]'); if (b) release(b.dataset.a);
}));
pad.addEventListener('click', e => {                 // keyboard activation of a focused pad button (Enter / Space)
  const b = e.target.closest('[data-a]');
  if (b && e.detail === 0) { press(b.dataset.a); setTimeout(() => release(b.dataset.a), 150); }
});

document.addEventListener('keydown', e => {
  if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (isFull()) exitFull(); else toGrid(); return; }   // Esc leaves full screen first
  if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); toggleFull(); return; }
  const t = e.target, inPad = t && t.closest && t.closest('#pad');
  if (t && t.closest && t.closest('a, button') && !inPad) return;     // don't steal Enter from links
  if (inPad && (e.code === 'Enter' || e.code === 'Space')) return;     // the pad button's own click handles it
  const a = GAMES[active].keymap[e.code];
  if (a) { e.preventDefault(); if (!e.repeat) press(a); return; }
  if (!e.repeat && ctl().state.phase === 'over' && (e.key === 'r' || e.key === 'R' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); press('act'); }
});
document.addEventListener('keyup', e => { if (active) { const a = GAMES[active].keymap[e.code]; if (a) release(a); } });
addEventListener('blur', () => { if (active && ctl().releaseAll) ctl().releaseAll(); });

grid.addEventListener('click', e => { const card = e.target.closest('[data-game]'); if (card) location.hash = card.dataset.game; });
[$('back'), $('arcadeHome')].forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (active) toGrid(); else scrollTo({ top: 0, behavior: 'smooth' }); }));
addEventListener('hashchange', route);

window.__arcade = { open, showGrid, game: id => games[id], preview: id => previews[id] };   // handy for tests
refreshBest();
route();
})();
