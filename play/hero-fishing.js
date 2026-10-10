/* Click the fishing bunny (or "Nikhil") on the home page to play Catch the Fish right in the hero:
   the text glides up out of the way and you take over the rod. Needs play/game.js (window.FishGame). */
(() => {
const hero = document.querySelector('.hero'), cv = document.getElementById('fish'), scene = document.getElementById('scene');
const triggers = [...document.querySelectorAll('[data-play="fish"]')];
if (!hero || !cv || !scene || !window.FishGame || !triggers.length) return;
const $ = id => document.getElementById(id);
const msg = $('fishMsg'), el = { score: $('fishScore'), time: $('fishTime'), mult: $('fishMult'), best: $('fishBest') };
const SKY = window.Sky ? Sky.place({ x: 290, y: 16 }) : null;   // the same sky as the idle scene, painted over the game
const paintSky = () => { if (SKY) Sky.paint(cv.getContext('2d'), SKY); };
let ctl = null, playing = false, hintTimer = 0, fadeTimer = 0, pauseTimer = 0, shown = {}, opener = triggers[0];

const flash = (text, ms) => {
  msg.textContent = text; msg.classList.add('show');
  clearTimeout(hintTimer); if (ms) hintTimer = setTimeout(() => msg.classList.remove('show'), ms);
};
function setHud(g, best) {
  const v = { score: g.score, time: Math.ceil(g.timeLeft / 1000), mult: g.mult, best };
  Object.keys(v).forEach(k => { if (shown[k] !== v[k]) { shown[k] = v[k]; el[k].textContent = k === 'mult' ? '×' + v[k] : v[k]; } });
}

function start(e) {
  if (e) e.preventDefault();                               // the bunny is a link to play.html for no-JS visitors
  if (playing) return;
  playing = true;
  opener = (e && e.currentTarget) || triggers[0];
  if (!ctl) ctl = FishGame.mount(cv, {
    onFrame(g, best) { paintSky(); setHud(g, best); },
    onEvent(ev, g, best) {
      if (ev.type === 'start') msg.classList.remove('show');
      else if (ev.type === 'catch') flash((ev.fish === 'golden' ? 'Golden fish! +' : 'Nice catch! +') + ev.points, 900);
      else if (ev.type === 'boot') flash('An old boot… −1', 900);
      else if (ev.type === 'early') flash('Too early! The fish got spooked', 900);
      else if (ev.type === 'miss') flash('It got away', 800);
      else if (ev.type === 'end') flash("Time's up! Score " + ev.score + (ev.isBest && ev.score > 0 ? ' (new best!)' : '') + ' · tap or Space to play again');
    }
  });
  clearTimeout(fadeTimer);
  ctl.reset(); shown = {};
  ctl.start({ cast: true });                              // the click casts the line straight away
  ctl.render(ctl.state, performance.now()); paintSky();   // same pond, same frame, same sky
  cv.hidden = false; void cv.offsetWidth;                 // commit the start state so the crossfade runs
  cv.classList.add('on');                                 // the game fades in over the idle scene (CSS: .35s)
  hero.classList.add('playing');                          // the features and buttons fade away; the hero keeps its size
  clearTimeout(pauseTimer);
  pauseTimer = setTimeout(() => { if (playing && window.HomeScene) HomeScene.pause(); }, 360);   // keep the idle scene alive under the crossfade
  flash('Hook it when you see the “!” · Space or tap · Esc to exit', 3200);
  cv.focus({ preventScroll: true });
}
function exit() {
  if (!playing) return;
  playing = false;
  ctl.stop();
  clearTimeout(pauseTimer);
  if (window.HomeScene) HomeScene.resume();
  hero.classList.remove('playing');                       // features and buttons fade back in
  cv.classList.remove('on'); msg.classList.remove('show');   // and the game crossfades back to the idle scene
  fadeTimer = setTimeout(() => { if (!playing) cv.hidden = true; }, 400);
  opener.focus({ preventScroll: true });
}

triggers.forEach(t => t.addEventListener('click', start));
$('fishExit').addEventListener('click', exit);
// while playing, a tap anywhere on the hero (outside the nav and HUD) works the rod
hero.addEventListener('pointerdown', e => {
  if (!playing || e.target.closest('a, button, nav')) return;
  e.preventDefault(); ctl.press();
});
document.addEventListener('keydown', e => {
  if (!playing || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { exit(); return; }
  const t = e.target;
  if (t && t.closest && t.closest('a, button')) return;   // let Enter work on Exit and links
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); ctl.press(); }
});
window.__heroFish = { start, exit, ctl: () => ctl };   // handy for previews
})();
