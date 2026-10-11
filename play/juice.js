/* Game feel for the Bunny Arcade: screen shake, pixel particles, pickup rings and confetti.
   Effects draw on their own canvas laid over the game (same 320×120 pixel grid), so the games' own drawing
   and rules are never touched. Juice.attach(field, gameCanvas) -> { shake, burst, ring, confetti, use, clear }. */
(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = ['#e0645a', '#e8b04a', '#6fbf73', '#6aa6c9', '#eaa5a0', '#f7f3ec'];

function attach(field, first) {
  const fx = document.createElement('canvas');
  fx.className = 'juice-layer'; fx.setAttribute('aria-hidden', 'true');
  field.appendChild(fx);
  const g = fx.getContext('2d');
  let game = first, parts = [], rings = [], raf = 0, shakeUntil = 0, shakeAt = 0, shakePx = 0;
  function use(cv) {                                  // follow whichever game canvas is showing
    game = cv; fx.width = cv.width; fx.height = cv.height;
  }
  use(first);

  function loop(now) {
    raf = 0;
    g.clearRect(0, 0, fx.width, fx.height);
    // particles: little squares with gravity that fade out
    parts = parts.filter(p => now - p.t < p.life);
    parts.forEach(p => {
      if (now < p.t) return;                         // confetti falls in a staggered wave
      const age = (now - p.t) / 1000;
      const x = p.x + p.vx * age, y = p.y + p.vy * age + 0.5 * p.g * age * age;
      g.globalAlpha = 1 - (now - p.t) / p.life;
      g.fillStyle = p.c; g.fillRect(Math.round(x), Math.round(y), p.s, p.s);
    });
    // rings: an expanding pixel circle
    rings = rings.filter(r => now - r.t < 360);
    rings.forEach(r => {
      const k = (now - r.t) / 360, rad = 2 + k * 9;
      g.globalAlpha = 1 - k; g.fillStyle = r.c;
      for (let a = 0; a < 12; a++) g.fillRect(Math.round(r.x + Math.cos(a / 12 * Math.PI * 2) * rad), Math.round(r.y + Math.sin(a / 12 * Math.PI * 2) * rad), 1, 1);
    });
    g.globalAlpha = 1;
    // shake: jitter both canvases with CSS, easing out
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / (shakeUntil - shakeAt), px = shakePx * k;
      const t = 'translate(' + ((Math.random() * 2 - 1) * px).toFixed(1) + '%,' + ((Math.random() * 2 - 1) * px * 2.4).toFixed(1) + '%)';
      game.style.transform = fx.style.transform = t;
    } else if (game.style.transform) game.style.transform = fx.style.transform = '';
    if (parts.length || rings.length || now < shakeUntil + 20) raf = requestAnimationFrame(loop);
  }
  const kick = () => { cancelAnimationFrame(raf); loop(performance.now()); };   // draw the first frame of an effect straight away

  return {
    use,
    // px is in game pixels; it becomes a percentage of the canvas so it scales with the game
    shake(px = 2, ms = 220) { if (reduced) return; const now = performance.now(); shakePx = px / 3.2; shakeAt = now; shakeUntil = now + ms; kick(); },
    burst(x, y, palette = ['#d8c3a5'], n = 8, { spread = 40, up = 40, gravity = 140, life = 520, size = 1 } = {}) {
      if (reduced) n = Math.min(n, 3);
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI;
        parts.push({ x, y, vx: Math.cos(a) * spread * (0.4 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1),
                     vy: -Math.sin(a) * up * (0.4 + Math.random() * 0.8), g: gravity, t: now, life: life * (0.7 + Math.random() * 0.5),
                     c: palette[i % palette.length], s: size + (Math.random() < 0.25 ? 1 : 0) });
      }
      kick();
    },
    ring(x, y, c = '#e8b04a') { rings.push({ x, y, c, t: performance.now() }); kick(); },
    confetti() {
      if (reduced) return;
      const now = performance.now();
      for (let i = 0; i < 90; i++) parts.push({ x: Math.random() * fx.width, y: -4 - Math.random() * 30, vx: (Math.random() * 2 - 1) * 18,
        vy: 10 + Math.random() * 30, g: 40, t: now + Math.random() * 300, life: 2200, c: CONFETTI[i % CONFETTI.length], s: 1 + (i % 3 === 0 ? 1 : 0) });
      kick();
    },
    clear() { parts = []; rings = []; shakeUntil = 0; if (game) game.style.transform = ''; fx.style.transform = ''; g.clearRect(0, 0, fx.width, fx.height); }
  };
}
window.Juice = { attach };
})();
