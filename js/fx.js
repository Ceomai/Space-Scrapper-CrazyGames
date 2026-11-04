// Particles, floating texts and synthesized sound effects (no audio files).
(function(SS){
SS.FX = {
  make() { return { parts: [], texts: [] }; },
  burst(fx, x, y, cols, n = 30, sp = 5) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, s = SS.rnd(.5, sp); fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: SS.rnd(.4, .9), max: .9, c: SS.pick(cols), sz: SS.rnd(2, 6) }); } },
  text(fx, x, y, txt, col, sub) { fx.texts.push({ x, y, txt, col, sub, life: 1.3 }); },
  step(fx, dt, f) {
    fx.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.vx *= .94; p.vy *= .94; p.life -= dt; }); fx.parts = fx.parts.filter(p => p.life > 0);
    fx.texts.forEach(t => { t.y -= .6 * f; t.life -= dt; }); fx.texts = fx.texts.filter(t => t.life > 0);
  },
  draw(fx, c) {
    for (const p of fx.parts) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.c; c.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    c.globalAlpha = 1;
  },
  drawText(fx, c, P) {
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const t of fx.texts) {
      c.globalAlpha = Math.min(1, t.life * 1.6);
      c.font = SS.tfont(22); c.lineWidth = 4; c.lineJoin = 'round'; c.strokeStyle = P.ui; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.col || P.accent; c.fillText(t.txt, t.x, t.y);
      if (t.sub) { c.font = SS.tfont(13); c.strokeText(t.sub, t.x, t.y + 15); c.fillStyle = P.text; c.fillText(t.sub, t.x, t.y + 15); }
    }
    c.globalAlpha = 1;
  },
};
SS.tfont = (px, w = 'bold') => `${w} ${px}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;

/* ---------- sound ---------- */
let AC = null;
const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
let unlocked = false; // browsers only allow audio after the first click/tap/key
SS.audioUnlock = () => { unlocked = true; return ac(); };
function tone(f, d, type, vol, slide = 0, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d);
}
SS.muted = () => (SS.meta && SS.meta.muted) || (SS.Platform && (SS.Platform.muted || SS.Platform.inAd));
SS.sfx = k => {
  if (SS.muted() || !unlocked || !ac()) return;
  const w = 'triangle', v = .08;
  try {
    switch (k) {
      case 'fire': tone(220, .12, w, v, 140); break;
      case 'grab': tone(140, .08, 'square', .04); break;
      case 'coin': tone(660, .09, w, v); tone(990, .12, w, v, 0, .07); break;
      case 'big': [523, 659, 784, 1046].forEach((f, i) => tone(f, .14, w, v, 0, i * .07)); break;
      case 'bad': tone(220, .25, 'sawtooth', .05, -100); break;
      case 'click': tone(520, .04, w, .035); break;
      case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .18, w, v, 0, i * .09)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, .22, w, v, 0, i * .12)); break;
      case 'boom': {
        const len = AC.sampleRate * .45, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        const s = AC.createBufferSource(), g = AC.createGain(), fl = AC.createBiquadFilter();
        fl.type = 'lowpass'; fl.frequency.value = 700; g.gain.value = .22;
        s.buffer = b; s.connect(fl).connect(g).connect(AC.destination); s.start(); break;
      }
    }
  } catch (e) {}
};

/* ---------- music: a calm, procedurally sequenced space loop (no audio files) ---------- */
// A minor progression Am – F – C – G, 84 bpm: soft pad, sine bass and a sparse arpeggio.
const MUS = { on: false, timer: 0, next: 0, step: 0, out: null };
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ARP = [0, 1, 2, 1, 2, 0, 1, 2];
function mNote(f, t, d, type, vol, attack = .02, cutoff = 1800) {
  const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cutoff;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + d);
  o.connect(fl).connect(g).connect(MUS.out); o.start(t); o.stop(t + d + .05);
}
function schedule() {
  if (!MUS.on || !AC) return;
  const spb = 60 / 84 / 2; // eighth notes
  while (MUS.next < AC.currentTime + .25) {
    const s = MUS.step, bar = Math.floor(s / 8) % 4, ch = CHORDS[bar], t = MUS.next;
    if (s % 8 === 0) { ch.forEach(n => { mNote(NOTE(n), t, spb * 8.2, 'triangle', .05, .6, 900); mNote(NOTE(n) * 1.004, t, spb * 8.2, 'sine', .03, .6, 900); }); mNote(NOTE(ch[0] - 12), t, spb * 3.5, 'sine', .09, .03, 400); }
    if (s % 8 === 4) mNote(NOTE(ch[0] - 12), t, spb * 3, 'sine', .07, .03, 400);
    if (s % 2 === 0 || Math.random() < .35) mNote(NOTE(ch[ARP[s % 8]] + 12), t, spb * 1.6, 'sine', .035, .01, 2400);
    MUS.next += spb; MUS.step++;
  }
}
SS.musicOn = () => !!(SS.meta && SS.meta.music !== false) && !SS.muted();
SS.music = {
  update() {
    const want = SS.musicOn() && !document.hidden && !(SS.Game && SS.Game.paused);
    if (want && !MUS.on) {
      if (!unlocked || !ac()) return;
      if (!MUS.out) { MUS.out = AC.createGain(); MUS.out.connect(AC.destination); }
      MUS.out.gain.cancelScheduledValues(AC.currentTime); MUS.out.gain.setValueAtTime(0, AC.currentTime); MUS.out.gain.linearRampToValueAtTime(.55, AC.currentTime + 1.2);
      MUS.on = true; MUS.next = AC.currentTime + .1; MUS.timer = setInterval(schedule, 80); schedule();
    } else if (!want && MUS.on) {
      MUS.on = false; clearInterval(MUS.timer);
      try { MUS.out.gain.cancelScheduledValues(AC.currentTime); MUS.out.gain.setValueAtTime(MUS.out.gain.value, AC.currentTime); MUS.out.gain.linearRampToValueAtTime(0, AC.currentTime + .25); } catch (e) {}
    }
  },
  get playing() { return MUS.on; },
};
})(window.SS);
