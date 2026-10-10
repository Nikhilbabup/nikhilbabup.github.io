/* Click the bunny in a project banner and it hops, then sprints out of the scene into Bug Runner:
   the banner scrolls away behind it and the game takes over in one continuous shot.
   Needs scene.js (window.SceneAPI), ../play/runner.js (window.BugRunner) and the #bannerPlay / #runner / #runnerHud / #runnerMsg markup. */
(() => {
const hero = document.querySelector('.hero');
const trigger = document.getElementById('bannerPlay'), cv = document.getElementById('runner');
if (!hero || !trigger || !cv || !window.BugRunner) return;
const $ = id => document.getElementById(id);
const content = hero.querySelector('.hero-content'), msg = $('runnerMsg'), scoreEl = $('runnerScore'), bestEl = $('runnerBest');
const scene = document.getElementById('scene'), api = window.SceneAPI;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ctl = null, playing = false, hintTimer = 0, shownScore = -1, fadeTimer = 0, scale = 1, shownShift = null;

// the banner scene, redrawn each frame as the left-most part of the runner's world
const W = api ? api.size.W : 320, H = api ? api.size.H : 120, GROUND = api ? api.size.GROUND : 108;
const farm = document.createElement('canvas'); farm.width = W; farm.height = H;
const farmCtx = farm.getContext('2d');
const prelude = (ctx, screenX, now, runnerX) => {
  if (!api) return;
  api.renderFrame(farmCtx, now, { hideBunny: true, runnerX });
  ctx.drawImage(farm, screenX, 0);
};

// the banner text is part of the farm: it scrolls left with it, in the same whole-pixel steps the farm is drawn at
const measure = () => { scale = cv.clientWidth / W || scene.clientWidth / W || 1; };
function moveContent(s) {
  const shift = Math.round(s.cfg.startDist - s.dist) * scale;   // 0 at the start, a full banner width once the farm has gone
  if (shift === shownShift) return;
  shownShift = shift;
  content.style.transform = shift ? 'translate3d(' + shift + 'px, 0, 0)' : '';
}
const flash = (text, ms) => {
  msg.textContent = text; msg.classList.add('show');
  clearTimeout(hintTimer); if (ms) hintTimer = setTimeout(() => msg.classList.remove('show'), ms);
};

function start() {
  if (playing) return;
  playing = true;
  if (!ctl) ctl = BugRunner.mount(cv, {
    world: { width: W, height: H, ground: GROUND },
    prelude,
    onFrame(s, best) { moveContent(s); if (s.score !== shownScore) { shownScore = s.score; scoreEl.textContent = s.score; } bestEl.textContent = best; },
    onEvent(e, s, best) {
      if (e.type === 'start') msg.classList.remove('show');
      if (e.type === 'hit') flash('Bug hit! Score ' + e.score + (e.isBest && e.score > 0 ? ' (new best!)' : '') + ' · tap or Space to run again');
    }
  });
  // start exactly where the scene's bunny is standing, then hop and sprint ~20px forward
  const b = (api && api.lastBunny()) || { x: Math.round(W * 0.31) };
  clearTimeout(fadeTimer); cv.style.transition = scene.style.transition = 'none';
  ctl.reset({ bunnyFrom: b.x, bunnyX: Math.min(b.x + 20, Math.round(W * 0.47)), startDist: -W, accelMs: 800, introJump: true, firstGap: 150 });
  shownScore = -1;
  ctl.start({ run: true });
  ctl.render(ctl.state, performance.now());              // first game frame == the scene, minus nothing
  cv.hidden = false; cv.classList.add('on');             // swap canvases in the same frame: no fade
  measure(); shownShift = null; content.style.transition = 'none'; moveContent(ctl.state);
  hero.classList.add('playing');
  if (api) api.pause();
  flash('Tap or press Space to jump · Esc to exit', 2800);
  cv.focus({ preventScroll: true });
  addEventListener('resize', measure);
}
function exit() {
  if (!playing) return;
  playing = false;
  ctl.stop();
  if (api) api.resume();
  cv.style.transition = scene.style.transition = 'opacity .4s ease';   // on the way out, a soft crossfade back to the farm
  content.style.transition = reduced ? 'none' : 'transform .5s cubic-bezier(.2, .8, .2, 1)'; content.style.transform = '';   // and the text slides back in
  hero.classList.remove('playing');
  cv.classList.remove('on'); msg.classList.remove('show');
  removeEventListener('resize', measure);
  fadeTimer = setTimeout(() => { if (!playing) { cv.hidden = true; cv.style.transition = scene.style.transition = content.style.transition = ''; } }, 550);
  trigger.focus({ preventScroll: true });
}

trigger.addEventListener('click', start);
$('runnerExit').addEventListener('click', exit);
cv.addEventListener('pointerdown', e => { if (playing) { e.preventDefault(); ctl.press(); } });
document.addEventListener('keydown', e => {
  if (!playing || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { exit(); return; }
  const t = e.target;
  if (t && t.closest && t.closest('a, button')) return;               // let Enter work on Exit and links
  if (['Space', 'Enter', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); ctl.press(); }
});
window.__banner = { start, exit, ctl: () => ctl };                    // handy for previews
})();
