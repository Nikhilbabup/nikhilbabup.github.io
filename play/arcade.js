/* Bunny Arcade: every mini-game on one page. The grid shows each game playing itself;
   pick one and it opens right here (arcade.html#fish, #runner, #carrots, ...), with its own scoreboard, controls and rules.
   Needs play/game.js (window.FishGame), play/runner.js (window.BugRunner), play/kit.js (window.Arcade) and play/games/*.js,
   plus play/juice.js (shake, particles, confetti), play/sfx.js (sound) and assets/sky.js (night games in dark mode). */
(() => {
const $ = id => document.getElementById(id);
const grid = $('grid'), view = $('view'), field = $('field'), overlay = $('overlay');
const el = { eyebrow: $('eyebrow'), heading: $('heading'), lead: $('lead'), hud: $('hud'), keys: $('keys'), rules: $('rules'),
  title: $('overlayTitle'), text: $('overlayText'), status: $('status'),
  score: $('overlayScore'), stars: $('overlayStars'), stats: $('overlayStats'), ribbon: $('overlayRibbon'), count: $('countdown'), cta: $('overlayCta') };
const touch = matchMedia('(hover: none)').matches;   // phones and tablets: the overlay asks for a tap
const home = { eyebrow: el.eyebrow.textContent, heading: el.heading.textContent, lead: el.lead.textContent, title: document.title };
const say = msg => { el.status.textContent = msg; };
const showOverlay = (title, text) => {
  el.title.textContent = title; el.text.textContent = text;
  el.cta.textContent = touch ? 'Tap to play' : 'Click to play';
  el.score.hidden = el.stars.hidden = el.stats.hidden = el.ribbon.hidden = true;
  overlay.hidden = false;
};
// the end of a game: a big score, 0–3 stars, a few stats, and a "New best!" ribbon with confetti
function showEnd(G, e, s, best, title, text) {
  const score = e.score, stars = G.stars ? G.stars.filter(t => score >= t).length : 0, isBest = e.isBest && score > 0;
  el.title.textContent = title;
  el.score.textContent = score; el.score.hidden = false;
  el.stars.innerHTML = [0, 1, 2].map(i => (i < stars ? '<b>★</b>' : '☆')).join('');
  el.stars.setAttribute('aria-label', stars + ' of 3 stars'); el.stars.hidden = !G.stars;
  const st = G.stats ? G.stats(s) : [];
  el.stats.innerHTML = st.map(([k, v]) => '<span>' + k + ' <b>' + v + '</b></span>').join(''); el.stats.hidden = !st.length;
  el.ribbon.hidden = !isBest;
  el.text.textContent = (isBest ? 'A new best! ' : 'Best: ' + best + '. ') + 'Press Enter or tap to play again.';
  el.cta.textContent = touch ? 'Tap to play again' : 'Click to play again';
  overlay.hidden = false;
  if (isBest || e.win) { if (juice) juice.confetti(); Sfx.play('win'); } else Sfx.play('lose');
  say(title + ' ' + text);
}
const toMap = (codes, a = 'act') => Object.fromEntries(codes.map(c => [c, a]));

/* Each game: title, lead, keys (hint), keymap { code: action }, tap / drag / swipe (pointer
   handling on the field), hud, values, intro, rules, bestKey, mount, onEvent, demo (preview opts), demoStart. */
const GAMES = {
  fish: {
    title: 'Catch the Fish', lead: 'The bunny has been fishing all day. Hook each bite the moment you see the “!”, and beat your best in 60 seconds.',
    keys: 'Space / Enter / tap', keymap: toMap(['Space', 'Enter']), bestKey: 'fishBest',
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
          showEnd(GAMES.fish, e, s, best, "Time's up!", 'You scored ' + e.score + (e.isBest && e.score > 0 ? ' (new best!)' : '') + '. Best: ' + best + '.');
          break;
        default: break;
      }
    },
    feel: {
      bite: e => (e.fish === 'boot' ? null : { sfx: 'tick' }),
      catch: e => ({ sfx: 'coin', x: 147, y: 99, ring: '#e8b04a', burst: [[e.fish === 'golden' ? '#f2c94c' : '#e8b04a', '#d6e8e2', '#b6d3cb'], 10, { up: 50 }] }),
      boot: () => ({ sfx: 'miss', shake: 1 }),
      early: () => ({ sfx: 'miss', x: 147, y: 101, burst: [['#d6e8e2', '#b6d3cb'], 5, { up: 25 }] }),
      miss: () => ({ sfx: 'miss' })
    },
    stats: s => [['Fish', s.caught], ['Combo', '×' + s.mult]],
    stars: [8, 16, 26],
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
    keys: 'Space / ↑ / tap', keymap: toMap(['Space', 'Enter', 'ArrowUp', 'KeyW']), bestKey: 'runnerBest',
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
        showEnd(GAMES.runner, e, s, best, 'Bug hit!', 'You scored ' + e.score + (e.isBest && e.score > 0 ? ' (new best!)' : '') + ' with ' + s.collected +
          (s.collected === 1 ? ' commit' : ' commits') + '. Best: ' + best + '.');
      }
    },
    feel: {                                          // Bug Runner's world is 240×90 with the ground at y 76
      jump: (e, s) => ({ sfx: 'jump', x: s.bx + 3, y: 76, burst: [['#e4d6c0', '#c4a28f'], 4, { up: 12, spread: 22, gravity: 60, life: 320 }] }),
      land: (e, s) => ({ x: s.bx + 3, y: 76, burst: [['#e4d6c0', '#c4a28f'], 5, { up: 14, spread: 30, gravity: 70, life: 340 }] }),
      commit: e => ({ sfx: 'coin', x: e.x + 2, y: 76 - e.y - 3, ring: '#6fbf73' }),
      hit: (e, s) => ({ sfx: 'hit', shake: 4, x: s.bx + 3, y: 76 - s.y - 6, burst: [['#f7f3ec', '#e0645a', '#2f3e3a'], 12] })
    },
    stats: s => [['Commits', s.collected], ['Distance', Math.max(0, Math.floor(s.dist / 8)) + ' m']],
    stars: [150, 400, 800],
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
    ...u, bestKey: id + 'Best', kit: true, toScreen: def.toScreen,
    mount: (cv, opts) => Arcade.mount(cv, def, opts),
    onEvent(e, s, best) {
      if (e.type === 'start') { overlay.hidden = true; say('Go!'); }
      else if (e.type === 'over') { const [title, text] = u.end(e, s, best); showEnd(GAMES[id], e, s, best, title, text); }
      else { const m = u.say && u.say(e, s); if (m) say(m); }
    },
    demo: () => ({ autoplay: true }),
    demoStart: ctl => ctl.start({ auto: true })
  };
});

/* ---------- night games: in dark mode every game is painted after dark, like the banners ---------- */
const places = {};
function night(cv, G) {
  if (!window.Sky || !Sky.dark) return;
  const key = cv.width + 'x' + cv.height;
  places[key] = places[key] || Sky.place({ x: cv.width - 30, y: 16, W: cv.width, H: cv.height });
  Sky.paint(cv.getContext('2d'), places[key], { strength: G.night ?? 1 });   // card- and label-heavy games get a lighter tint
}

/* ---------- game feel: each game maps its events to sound, shake, hit-stop and particles ---------- */
let juice = null;
function feel(G, e, s) {
  const f = G.feel && G.feel[e.type], spec = typeof f === 'function' ? f(e, s) : f;
  if (!spec) return;
  if (spec.sfx) Sfx.play(spec.sfx);
  if (spec.shake) juice.shake(spec.shake);
  if (spec.stop && ctl().freeze) ctl().freeze(spec.stop);
  if (spec.confetti) juice.confetti();
  let x = spec.x ?? e.x, y = spec.y ?? e.y;
  if (x == null || y == null) return;
  if (G.toScreen) [x, y] = G.toScreen(s, x, y);
  if (spec.ring) juice.ring(x, y, spec.ring);
  if (spec.burst) juice.burst(x, y, ...spec.burst.filter(v => v != null));
}

/* ---------- live previews on the cards ---------- */
const previews = {};
document.querySelectorAll('[data-preview]').forEach(cv => {
  const id = cv.dataset.preview, G = GAMES[id];
  if (!G) return;
  let ctl = null;
  const d = G.demo(() => ctl), own = d.onFrame;
  d.onFrame = (s, best) => { if (own) own(s, best); night(cv, G); };
  ctl = G.mount(cv, { saveBest: false, ...d });
  previews[id] = ctl;
});
// Keep the grid light: every card plays for a moment so it settles on a mid-game still frame, then only the card
// you point at (or focus) keeps playing. On touch screens and with reduced motion the cards stay still.
const still = matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches;
let warmTimer = 0, pointed = null;
const playPreview = id => { if (previews[id]) GAMES[id].demoStart(previews[id]); };
const pausePreview = id => { if (previews[id] && id !== pointed) previews[id].stop(); };
function startPreviews() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  Object.keys(previews).forEach(playPreview);
  clearTimeout(warmTimer);
  warmTimer = setTimeout(() => Object.keys(previews).forEach(pausePreview), 1500);
}
const stopPreviews = () => { clearTimeout(warmTimer); Object.values(previews).forEach(p => p.stop()); };
if (!still) grid.querySelectorAll('[data-game]').forEach(card => {
  const id = card.dataset.game;
  const on = () => { pointed = id; if (!active) playPreview(id); };
  const off = () => { if (pointed === id) pointed = null; pausePreview(id); };
  card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off);
  card.addEventListener('focus', on); card.addEventListener('blur', off);
});

/* ---------- the single-game view ---------- */
const games = {}, canvases = {};
let active = null, shown = {}, wipeTimer = 0;
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
// scoreboard numbers roll up to their new value and pop when they grow
const rolling = new Map();
function roll(b, from, to) {
  cancelAnimationFrame(rolling.get(b));
  const t0 = performance.now(), step = () => {
    const k = Math.max(0, Math.min(1, (performance.now() - t0) / 300));   // one clock throughout
    b.textContent = k < 1 ? Math.round(from + (to - from) * (1 - (1 - k) ** 3)) : to;
    if (k < 1) rolling.set(b, requestAnimationFrame(step));
  };
  rolling.set(b, requestAnimationFrame(step));
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}
const showValues = (v, animate) => Object.keys(v).forEach(k => {
  if (shown[k] === v[k]) return;
  const before = shown[k]; shown[k] = v[k];
  const b = el.hud.querySelector('[data-k="' + k + '"]'); if (!b) return;
  if (animate && typeof v[k] === 'number' && typeof before === 'number' && v[k] > before && k !== 'time' && k !== 'best') roll(b, before, v[k]);
  else { cancelAnimationFrame(rolling.get(b)); b.textContent = v[k]; }
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
  field.style.touchAction = G.swipe || G.drag || G.zones ? 'none' : '';
  el.eyebrow.textContent = 'Bunny Arcade'; el.heading.textContent = G.title; el.lead.textContent = G.lead;
  document.title = G.title + ' · Bunny Arcade';
  if (!games[id]) games[id] = G.mount(cv, {
    onFrame: (s, best) => { night(cv, G); showValues(G.values(s, best), true); },
    onEvent: (e, s, best) => { if (e.type === 'start') { shown = {}; started = true; } feel(G, e, s); G.onEvent(e, s, best); }
  });
  else games[id].reset();
  showValues(G.values(games[id].state, games[id].best));    // real starting values (60s, ×1, best) right away
  showOverlay(G.intro[0], G.intro[1]);
  if (juice) juice.use(cv); else juice = Juice.attach(field, cv);
  juice.clear(); cancelCountdown(); started = false;
  games[id].start();
  field.classList.remove('wipe'); void field.offsetWidth; field.classList.add('wipe');   // an iris opens onto the game
  clearTimeout(wipeTimer); wipeTimer = setTimeout(() => field.classList.remove('wipe'), 500);
  grid.hidden = true; view.hidden = false; document.body.classList.add('in-game');
  if (innerWidth > innerHeight && innerHeight < 500) stage.scrollIntoView({ block: 'start' });   // a phone on its side: the game fills the screen
  else scrollTo({ top: 0 });
  cv.focus({ preventScroll: true });
}

function showGrid() {
  const was = active;
  if (isFull()) exitFull();
  cancelCountdown(); if (juice) juice.clear();
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
const ICON_ON = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z" fill="currentColor"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 1h2v5H1V4h3zM10 1h2v3h3v2h-5zM1 10h5v5H4v-3H1zM10 10h5v2h-3v3h-2z" fill="currentColor"/></svg>';
const canFull = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
const isFull = () => stage.classList.contains('is-full');
function setFull(on) {
  stage.classList.toggle('is-full', on);
  document.body.classList.toggle('fake-full', on && !(document.fullscreenElement || document.webkitFullscreenElement));
  fullBtn.setAttribute('aria-pressed', String(on));
  fullBtn.innerHTML = on ? ICON_OFF : ICON_ON;
  fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
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

/* ---------- countdown: the first start of a game counts 3, 2, 1, GO ---------- */
let started = false, counting = false, countTimers = [];
const keysDown = new Set();
function cancelCountdown() { countTimers.forEach(clearTimeout); countTimers = []; counting = false; el.count.hidden = true; }
function countdown() {
  counting = true; overlay.hidden = true; el.count.hidden = false;
  ['3', '2', '1', 'GO!'].forEach((n, i) => countTimers.push(setTimeout(() => {
    el.count.innerHTML = '<span>' + n + '</span>'; Sfx.play(i < 3 ? 'tick' : 'go');
  }, i * 480)));
  countTimers.push(setTimeout(() => {
    cancelCountdown(); started = true;
    if (GAMES[active].kit) ctl().start({ auto: true }); else ctl().press();
    keysDown.forEach(code => { const a = GAMES[active].keymap[code]; if (a && GAMES[active].kit) ctl().press(a); });   // keys still held carry on
    zoneHeld.forEach(a => { if (GAMES[active].kit) ctl().press(a); });
  }, 4 * 480 - 120));
}
// true when this input was used to begin the countdown (or arrived during it) rather than played
function gate() {
  if (counting) return true;
  if (!started && ctl().state.phase === 'ready') { countdown(); return true; }
  return false;
}

/* ---------- input ---------- */
const press = a => { if (active && !gate()) ctl().press(a); };
const release = a => { if (active && ctl().release) ctl().release(a); };
function toCanvas(e) {
  const cv = canvases[active], r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
}
let swipe = null, dragging = null;
const zoneHeld = new Map();                          // pointerId -> the action its touch zone is holding
field.addEventListener('pointerdown', e => {
  if (!active || e.target.closest('.full-btn')) return;   // the full-screen button is not a move
  e.preventDefault();
  const G = GAMES[active];
  if (G.zones) {                                     // touch zones: hold a third of the field to run, tap one to jump; fingers combine
    const f = toCanvas(e).x / canvases[active].width, z = G.zones.find(([a, b]) => f >= a && f < b) || G.zones[G.zones.length - 1];
    zoneHeld.set(e.pointerId, z[2]); press(z[2]); return;
  }
  if (G.swipe) { swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }   // decided on release: a swipe or a tap
  if (G.tap) { if (gate()) return; const p = toCanvas(e); ctl().tap(p.x, p.y); if (G.drag) dragging = e.pointerId; }
  else press('act');
});
field.addEventListener('pointermove', e => {
  if (active && dragging === e.pointerId) { const p = toCanvas(e); ctl().tap(p.x, p.y, 'move'); }
});
const releaseZone = e => { if (zoneHeld.has(e.pointerId)) { release(zoneHeld.get(e.pointerId)); zoneHeld.delete(e.pointerId); } };
addEventListener('pointerup', e => {
  releaseZone(e);
  if (active && swipe && swipe.id === e.pointerId) {
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) > 24) press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    else if (!gate()) { const p = toCanvas(e); ctl().tap(p.x, p.y); }
  }
  swipe = null; dragging = null;
});
addEventListener('pointercancel', e => { releaseZone(e); swipe = null; dragging = null; });

/* ---------- sound: off until switched on, remembered ---------- */
const sndBtn = $('sndBtn');
const showSound = on => {
  sndBtn.setAttribute('aria-pressed', String(on));
  sndBtn.setAttribute('aria-label', on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on');
  sndBtn.title = (on ? 'Sound on' : 'Sound off') + ' (M)';
};
showSound(Sfx.on); Sfx.onChange(showSound);
sndBtn.addEventListener('click', () => { Sfx.toggle(); if (active) canvases[active].focus({ preventScroll: true }); });

document.addEventListener('keydown', e => {
  if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { if (isFull()) exitFull(); else toGrid(); return; }   // Esc leaves full screen first
  if (e.code === 'KeyF' && !e.repeat) { e.preventDefault(); toggleFull(); return; }
  if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); Sfx.toggle(); return; }
  keysDown.add(e.code);
  const t = e.target;
  if (t && t.closest && t.closest('a, button')) return;     // don't steal Enter from links and buttons
  const a = GAMES[active].keymap[e.code];
  if (a) { e.preventDefault(); if (!e.repeat) press(a); return; }
  if (!e.repeat && ctl().state.phase === 'over' && (e.key === 'r' || e.key === 'R' || e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); press('act'); }
});
document.addEventListener('keyup', e => { keysDown.delete(e.code); if (active) { const a = GAMES[active].keymap[e.code]; if (a) release(a); } });
addEventListener('blur', () => { keysDown.clear(); if (active && ctl().releaseAll) ctl().releaseAll(); });

grid.addEventListener('click', e => { const card = e.target.closest('[data-game]'); if (card) location.hash = card.dataset.game; });
[$('back'), $('arcadeHome')].forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (active) toGrid(); else scrollTo({ top: 0, behavior: 'smooth' }); }));
addEventListener('hashchange', route);

window.__arcade = { open, showGrid, game: id => games[id], preview: id => previews[id], juice: () => juice };   // handy for tests
refreshBest();
route();
})();
