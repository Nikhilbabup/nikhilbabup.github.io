/* Retro sound effects for the Bunny Arcade, synthesised with WebAudio: no audio files.
   Off until the player switches it on (the speaker button or M); the choice is remembered.
   The AudioContext is only created when sound is switched on, so nothing plays or loads before that. */
(() => {
const KEY = 'sound';
let on = false, ctx = null, master = null, noiseBuf = null;
try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage blocked */ }
const subs = new Set();

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.18; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// one note: a waveform sliding from f0 to f1 Hz, with a quick attack and an exponential release
function tone(type, f0, f1, dur, at = 0, vol = 1) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, at = 0, vol = 0.6, cutoff = 1800) {
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = cutoff;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}

const PRESETS = {
  jump:  () => tone('square', 240, 520, 0.12, 0, 0.5),
  flap:  () => tone('square', 300, 460, 0.07, 0, 0.35),
  coin:  () => { tone('square', 988, 988, 0.06, 0, 0.45); tone('square', 1319, 1319, 0.16, 0.06, 0.45); },
  stomp: () => { tone('square', 320, 90, 0.12, 0, 0.6); noise(0.08, 0, 0.35, 900); },
  hit:   () => { tone('sawtooth', 400, 60, 0.35, 0, 0.5); noise(0.25, 0, 0.4, 1400); },
  miss:  () => tone('triangle', 330, 196, 0.18, 0, 0.5),
  pass:  () => { tone('square', 660, 660, 0.05, 0, 0.4); tone('square', 880, 880, 0.08, 0.05, 0.4); },
  win:   () => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i === 3 ? 0.35 : 0.1, i * 0.1, 0.45)),
  lose:  () => [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.18, i * 0.15, 0.55)),
  tick:  () => tone('square', 660, 660, 0.06, 0, 0.35),
  go:    () => tone('square', 1047, 1047, 0.2, 0, 0.45),
  click: () => tone('triangle', 880, 660, 0.05, 0, 0.3)
};

function play(name) {
  if (!on || !PRESETS[name] || !audio()) return;
  if (ctx.state === 'suspended') ctx.resume();
  try { PRESETS[name](); } catch (e) { /* never let a sound break a game */ }
}
function set(v) {
  on = !!v;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
  if (on && audio() && ctx.state === 'suspended') ctx.resume();
  subs.forEach(fn => fn(on));
  if (on) play('click');
}

window.Sfx = { play, set, toggle: () => set(!on), get on() { return on; }, get started() { return !!ctx }, onChange: fn => subs.add(fn) };
})();
