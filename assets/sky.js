/* Day and night for the pixel-art banners (home page and project pages).
   Click the sun: it sinks behind the trees in a warm glow, the site fades into dark mode, stars come out and the moon rises.
   Click the moon: it sets, the sky warms at dawn and the sun comes back up, and the site fades back to light.

   A banner calls Sky.paint(ctx, place) after drawing its scene each frame and Sky.attach(canvas, place) once for the
   click target. The sun and moon are drawn *behind* the scene (destination-over), so they really set behind the trees.
   The theme is <html data-theme="light|dark">, saved in localStorage; each page's <head> sets it before first paint. */
(() => {
const root = document.documentElement, KEY = 'theme', DUR = 2600;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let dark = root.dataset.theme === 'dark', anim = null, raf = 0;
const subs = new Set();

const clamp01 = u => Math.max(0, Math.min(1, u));
const smooth = (a, b, u) => { const k = clamp01((u - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeIn = u => u * u * u;
const easeOut = u => 1 - (1 - u) ** 3;
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = c => 'rgb(' + c.join(',') + ')';
const GOLD = [242, 201, 76], ORANGE = [240, 138, 75], RED = [226, 87, 76];
const sunColor = k => rgb(k < 0.5 ? mix(GOLD, ORANGE, k * 2) : mix(ORANGE, RED, (k - 0.5) * 2));   // k: 0 high in the sky, 1 on the horizon

function setTheme(isDark) {
  root.dataset.theme = isDark ? 'dark' : 'light';
  try { localStorage.setItem(KEY, isDark ? 'dark' : 'light'); } catch (e) { /* storage blocked */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? '#1c3040' : '#d3e6de';
}
const notify = () => subs.forEach(fn => fn());
if (dark) { const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = '#1c3040'; }

// the whole transition runs on its own clock, so the theme still flips even if no banner is on screen
function run() {
  const u = (performance.now() - anim.start) / DUR;
  if (!anim.flipped && u >= 0.3) { anim.flipped = true; setTheme(anim.toDark); }   // CSS colours fade over 1.2s, in step with the sky
  if (u >= 1) {
    dark = anim.toDark; anim = null; raf = 0;
    setTimeout(() => { if (!anim) root.classList.remove('theme-anim'); }, 100);
    notify(); return;
  }
  notify();
  raf = requestAnimationFrame(run);
}
function toggle() {
  if (anim) return;
  if (reduced) { dark = !dark; setTheme(dark); notify(); return; }
  anim = { toDark: !dark, start: performance.now(), flipped: false };
  root.classList.add('theme-anim');
  raf = requestAnimationFrame(run);
}

/* What the sky looks like right now. Positions are along each banner's own path (see place()). */
function look(t) {
  if (!anim) return dark
    ? { dark: 1, glow: 0, stars: 1, sun: null, moon: { k: 0, rise: true } }
    : { dark: 0, glow: 0, stars: 0, sun: { k: 0, rise: true }, moon: null };
  const u = clamp01((t - anim.start) / DUR);
  if (anim.toDark) {                                  // sunset, then moonrise
    const s = clamp01(u / 0.55), m = clamp01((u - 0.45) / 0.55);
    return { dark: smooth(0.2, 0.75, u), glow: Math.sin(Math.PI * clamp01(u / 0.8)), warm: [242, 140, 90], stars: smooth(0.5, 0.95, u),
             sun: s < 1 ? { k: s, rise: false } : null, moon: m > 0 ? { k: 1 - m, rise: true } : null };
  }
  const m = clamp01(u / 0.5), s = clamp01((u - 0.4) / 0.6);   // moonset, then sunrise
  return { dark: 1 - smooth(0.25, 0.8, u), glow: Math.sin(Math.PI * clamp01((u - 0.15) / 0.8)), warm: [240, 160, 140], stars: 1 - smooth(0.05, 0.45, u),
           moon: m < 1 ? { k: m, rise: false } : null, sun: s > 0 ? { k: 1 - s, rise: true } : null };
}

/* A banner's sky: where the sun and moon rest (x, y) on a W×H canvas. They set down and to the right,
   and rise from down and to the left, below the bottom edge where the ground hides them. */
function place({ x, y, W = 320, H = 120 }) {
  const cel = document.createElement('canvas'); cel.width = W; cel.height = H;
  const r = (() => { let s = 99; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const stars = Array.from({ length: 22 }, () => ({ x: Math.floor(r() * W), y: Math.floor(4 + r() * H * 0.42), big: r() < 0.25, ph: r() * 6 }));
  return { x, y, W, H, low: H + 8, cel, stars };
}
const at = (p, b) => b.rise                              // k: 0 at rest, 1 fully set or not yet risen
  ? { x: Math.round(p.x - 22 * b.k), y: Math.round(p.y + (p.low - p.y) * easeIn(b.k)) }
  : { x: Math.round(p.x + 18 * b.k), y: Math.round(p.y + (p.low - p.y) * easeIn(b.k)) };

function disc(g, cx, cy, r, inner, rim) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = x * x + y * y;
    if (d <= r * r + r * 0.6) { g.fillStyle = d > (r - 1) * (r - 1) + 1 ? rim : inner; g.fillRect(cx + x, cy + y, 1, 1); }
  }
}
function drawCelestial(p, L, t) {
  const g = p.cel.getContext('2d');
  g.clearRect(0, 0, p.W, p.H);
  if (L.stars > 0) p.stars.forEach(s => {
    const tw = reduced ? 1 : 0.55 + 0.45 * Math.sin(t / 700 + s.ph);
    g.globalAlpha = L.stars * tw; g.fillStyle = '#f6e7b8';
    g.fillRect(s.x, s.y, 1, 1);
    if (s.big) { g.globalAlpha *= 0.5; g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
  });
  g.globalAlpha = 1;
  if (L.moon) {
    const { x, y } = at(p, L.moon);
    g.globalAlpha = 0.18; disc(g, x, y, 7, '#f3ecd2', '#f3ecd2'); g.globalAlpha = 1;   // soft halo
    disc(g, x, y, 4, '#f6f0da', '#d9d0b0');
    g.clearRect(x + 1, y - 4, 2, 1); g.clearRect(x + 2, y - 3, 3, 2); g.clearRect(x + 3, y - 1, 2, 3); g.clearRect(x + 2, y + 2, 3, 1);   // the crescent's shadow
    g.fillStyle = '#ddd3b3'; g.fillRect(x - 2, y - 1, 1, 1); g.fillRect(x - 1, y + 2, 1, 1);    // craters
  }
  if (L.sun) {
    const { x, y } = at(p, L.sun), k = L.sun.k, r = 4 + Math.round(k);   // a touch bigger and redder near the horizon
    const c = sunColor(k);
    g.globalAlpha = 0.22 + 0.2 * k; disc(g, x, y, r + 3, c, c); g.globalAlpha = 1;          // glow around it
    disc(g, x, y, r, c, rgb(mix(k < 0.5 ? mix(GOLD, ORANGE, k * 2) : mix(ORANGE, RED, (k - 0.5) * 2), [255, 255, 255], 0.25)));
    if (k < 0.35) {                                   // rays, fading as it sinks
      g.globalAlpha = 1 - k / 0.35; g.fillStyle = c;
      const on = reduced || Math.floor(t / 300) % 2;
      const d = r + (on ? 3 : 2), dd = Math.round(d * 0.72);
      [[0, -d], [0, d], [-d, 0], [d, 0], [-dd, -dd], [dd, -dd], [-dd, dd], [dd, dd]].forEach(([ox, oy]) => g.fillRect(x + ox, y + oy, 1, 1));
      g.globalAlpha = 1;
    }
  }
  return p.cel;
}

// Call after the scene is drawn: tints the scene for dusk / night, then puts the sky behind it.
function paint(ctx, p) {
  const t = performance.now(), L = look(t), W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';      // only what the scene drew: trees, ground, water, bunny...
  if (L.glow > 0) { ctx.fillStyle = 'rgba(' + L.warm.join(',') + ',' + (0.2 * L.glow).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  if (L.dark > 0) { ctx.fillStyle = 'rgba(12, 20, 44, ' + (0.48 * L.dark).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.globalCompositeOperation = 'destination-over'; // behind the scene: the sun, moon and stars...
  ctx.drawImage(drawCelestial(p, L, t), 0, 0);
  if (L.glow > 0) {                                  // ...and behind them, a warm glow rising from the horizon
    const a = 0.5 * L.glow, w = L.warm.join(','), grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, 'rgba(' + w + ',' + a.toFixed(3) + ')');
    grad.addColorStop(0.45, 'rgba(234,165,160,' + (a * 0.55).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(234,165,160,0)');    // fades out at the top, into the page's own sky colour
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// the click target over the sun / moon, sized for fingers, inside a box that tracks the canvas
function attach(canvas, p) {
  const box = document.createElement('div');
  box.className = 'sky-box';
  box.style.aspectRatio = p.W + ' / ' + p.H;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'sky-hit';
  b.style.left = (p.x / p.W * 100) + '%'; b.style.top = (p.y / p.H * 100) + '%';
  let shown = null;
  const label = () => {
    const toDark = anim ? !anim.toDark : !dark;      // what the next click will do
    if (shown === toDark) return;
    shown = toDark;
    b.setAttribute('aria-label', toDark ? 'Watch the sunset (switch to dark mode)' : 'Watch the sunrise (switch to light mode)');
    b.dataset.tip = toDark ? 'Sunset ☾' : 'Sunrise ☀';
    b.setAttribute('aria-pressed', String(!toDark));
  };
  label(); subs.add(label);
  b.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  b.addEventListener('pointerdown', e => e.stopPropagation());   // never a jump or a cast in a banner game
  box.appendChild(b);
  canvas.insertAdjacentElement('afterend', box);
  return b;
}

window.Sky = {
  paint, attach, place, toggle,
  busy: () => !!anim,                                // banners draw every frame while the sky is changing
  get dark() { return dark; },
  onChange: fn => subs.add(fn)
};
})();
