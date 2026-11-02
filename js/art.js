// Space Scrapper (CrazyGames edition) — drawing layer.
// Adapted from the original Space Scrapper art code: ship, claw, items, space backdrop.
(function(SS){
const Art = SS.Art = {};
const TAU = Math.PI * 2;

Art.style = () => document.documentElement.dataset.style || 'vector';
// Sahne paleti renk temasından gelir (zorluktan bağımsız)
SS.palKey = () => (SS.THEMES.find(t => t.id === document.documentElement.dataset.theme) || SS.THEMES[0]).pal;
Art.P = () => SS.PAL[SS.palKey()];

// Piksel paleti için önbellekli en yakın renk tablosu
let qMode = null, qCache = null, qPal = null;
function quantTable() {
  const mode = SS.palKey();
  if (qMode !== mode) {
    qMode = mode; qCache = new Int16Array(32768).fill(-1);
    qPal = SS.PIXPAL[mode].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  }
}
function nearest(r, g, b) {
  const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
  let k = qCache[key];
  if (k < 0) {
    let bd = 1e9; k = 0;
    for (let i = 0; i < qPal.length; i++) {
      const p = qPal[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = dr * dr * .3 + dg * dg * .59 + db * db * .11;
      if (d < bd) { bd = d; k = i; }
    }
    qCache[key] = k;
  }
  return qPal[k];
}

// Bir canvas'ı mantıksal W×H boyutuna göre stile uygun hazırlar
Art.setup = (canvas, W, H, pixK = .5) => {
  const pixel = Art.style() === 'pixel';
  const k = pixel ? pixK : Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(W * k)); canvas.height = Math.max(1, Math.round(H * k));
  canvas.style.imageRendering = pixel ? 'pixelated' : 'auto';
  const ctx = canvas.getContext('2d', { willReadFrequently: pixel });
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = !pixel;
  return { ctx, k, pixel };
};
// Piksel modda kareyi palete indirger, saydamlığı keskinleştirir
Art.post = (canvas, ctx, pixel) => {
  if (!pixel) return;
  quantTable();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 100) { d[i + 3] = 0; continue; }
    const p = nearest(d[i], d[i + 1], d[i + 2]);
    d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};
// Statik küçük çizimler (ikonlar, portreler, önizlemeler)
Art.paint = (canvas, W, H, fn, pixK = 1) => {
  const { ctx, pixel } = Art.setup(canvas, W, H, pixK);
  ctx.clearRect(0, 0, W, H);
  fn(ctx, Art.P());
  Art.post(canvas, ctx, pixel);
};
Art.paintAll = root => {
  (root || document).querySelectorAll('canvas[data-draw]').forEach(c => {
    const [kind, arg] = c.dataset.draw.split(':');
    const w = +c.getAttribute('width') || 44, h = +c.getAttribute('height') || 44;
    c.style.width = w + 'px'; c.style.height = h + 'px';
    Art.paint(c, w, h, (ctx, P) => Art.icon(ctx, kind, w, h, P, arg), c.dataset.pix ? +c.dataset.pix : 1);
  });
};

/* ---------- background ---------- */
Art.makeStars = (n, W, H) => Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < .15 ? 1.6 : .9, tw: Math.random() * 6 }));
Art.space = (c, W, H, t, zone, stars, P) => {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.space0); g.addColorStop(1, P.space1);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = P.neb1; c.beginPath(); c.ellipse(W * .2, H * .35, W * .5, H * .16, -.4, 0, TAU); c.fill();
  c.fillStyle = P.neb2; c.beginPath(); c.ellipse(W * .85, H * .7, W * .45, H * .14, .5, 0, TAU); c.fill();
  for (const s of stars) {
    c.globalAlpha = .5 + .5 * Math.sin(t * 2 + s.tw);
    c.fillStyle = P.star; c.fillRect(s.x, s.y, s.r * 1.6, s.r * 1.6);
  }
  c.globalAlpha = 1;
  if (zone === 'gas') {
    const pg = c.createRadialGradient(W * .5, H + 260, 40, W * .5, H + 260, 420);
    pg.addColorStop(0, P.crystal2); pg.addColorStop(.75, P.slimeD); pg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = pg; c.beginPath(); c.arc(W * .5, H + 260, 420, 0, TAU); c.fill();
    c.strokeStyle = P.crystal; c.globalAlpha = .35; c.lineWidth = 3;
    c.beginPath(); c.ellipse(W * .5, H - 40, W * .8, 40, -.08, Math.PI, TAU); c.stroke(); c.globalAlpha = 1;
  } else if (zone === 'yard' || zone === 'lost') {
    c.fillStyle = zone === 'lost' ? P.boxD : P.metalD; c.globalAlpha = .35;
    c.beginPath(); c.moveTo(-10, H * .55); c.lineTo(W * .35, H * .5); c.lineTo(W * .4, H * .58); c.lineTo(W * .1, H * .68); c.lineTo(-10, H * .66); c.fill();
    c.beginPath(); c.moveTo(W + 10, H * .78); c.lineTo(W * .62, H * .82); c.lineTo(W * .7, H * .9); c.lineTo(W + 10, H * .92); c.fill();
    c.globalAlpha = 1;
  } else if (zone === 'pirate') {
    const on = Math.sin(t * 3) > 0;
    c.fillStyle = on ? P.bad : P.tankD; c.globalAlpha = .18; c.fillRect(0, 0, 8, H); c.fillRect(W - 8, 0, 8, H); c.globalAlpha = 1;
  }
};

/* ---------- ship ---------- */
// Kademeli gemiler: 1 = Gezgin Martı (beyaz, kanatlı), 2 = Demir Balina (iri, lacivert)
function shipTier(c, x, y, s, t, P, opts, tier) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (tier === 1) {
    if (opts.flame) { c.fillStyle = P.flame; c.beginPath(); c.moveTo(-30, 4); c.lineTo(-52, 7); c.lineTo(-30, 10); c.fill(); c.beginPath(); c.moveTo(30, 4); c.lineTo(52, 7); c.lineTo(30, 10); c.fill(); }
    c.fillStyle = P.metalD; c.beginPath(); c.moveTo(-60, 2); c.lineTo(-26, -8); c.lineTo(-20, 6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(60, 2); c.lineTo(26, -8); c.lineTo(20, 6); c.closePath(); c.fill();
    c.fillStyle = P.metalL; c.beginPath(); c.moveTo(-40, 10); c.quadraticCurveTo(-36, -14, -10, -16); c.lineTo(10, -16); c.quadraticCurveTo(36, -14, 40, 10); c.quadraticCurveTo(0, 22, -40, 10); c.fill();
    c.fillStyle = P.crystal; c.fillRect(-34, 2, 68, 4);
    c.fillStyle = P.glass; c.beginPath(); c.arc(0, -15, 13, Math.PI, Math.PI * 2); c.fill();
    c.fillStyle = P.hull2; c.beginPath(); c.arc(0, -13, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = P.ui; c.fillRect(-4, -15, 8, 3);
    c.fillStyle = P.metalD; c.fillRect(-7, 16, 14, 9);
  } else {
    if (opts.flame) { c.fillStyle = P.flame; c.beginPath(); c.moveTo(-58, -2); c.lineTo(-80, 3); c.lineTo(-58, 8); c.fill(); }
    c.fillStyle = P.ui; c.beginPath(); c.moveTo(-60, 10); c.quadraticCurveTo(-62, -22, -10, -24); c.quadraticCurveTo(50, -24, 62, 0); c.quadraticCurveTo(60, 20, 20, 22); c.lineTo(-40, 22); c.quadraticCurveTo(-60, 20, -60, 10); c.fill();
    c.fillStyle = P.metalD; c.beginPath(); c.moveTo(-20, -24); c.lineTo(-6, -38); c.lineTo(4, -24); c.fill();
    c.fillStyle = P.metal; c.fillRect(-52, 4, 108, 4);
    c.fillStyle = P.glass; [-34, -20, -6].forEach(px => { c.beginPath(); c.arc(px, -8, 4, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = P.glass; c.beginPath(); c.ellipse(40, -8, 12, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.hull2; c.beginPath(); c.arc(40, -8, 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = Math.sin(t * 5) > 0 ? P.good : P.metalD; c.beginPath(); c.arc(-6, -38, 2.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.metalD; c.fillRect(-8, 20, 16, 8);
  }
  c.restore();
}
Art.ship = (c, x, y, s, t, P, opts = {}) => {
  if (SS.paintPalette && !opts.raw) P = SS.paintPalette(P);
  if (opts.tier) return shipTier(c, x, y, s, t, P, opts, opts.tier);
  c.save(); c.translate(x, y); c.scale(s, s);
  if (opts.flame) {
    const f = 10 + Math.sin(t * 40) * 4;
    c.fillStyle = P.flame; c.beginPath(); c.moveTo(-34, 2); c.lineTo(-34 - f * 1.6, 6); c.lineTo(-34, 10); c.fill();
    c.beginPath(); c.moveTo(34, 2); c.lineTo(34 + f * 1.6, 6); c.lineTo(34, 10); c.fill();
  }
  // gövde
  c.fillStyle = P.hullD; c.beginPath(); c.moveTo(-44, 6); c.lineTo(44, 6); c.lineTo(34, 20); c.lineTo(-34, 20); c.closePath(); c.fill();
  c.fillStyle = P.hull; c.beginPath(); c.moveTo(-48, 8); c.quadraticCurveTo(-46, -12, -18, -14); c.lineTo(18, -14); c.quadraticCurveTo(46, -12, 48, 8); c.closePath(); c.fill();
  c.fillStyle = P.hull2; c.fillRect(-40, 0, 80, 4);
  // yamalar (külüstür his)
  c.fillStyle = P.metal; c.fillRect(-36, -8, 9, 7); c.fillRect(24, -6, 8, 6);
  c.fillStyle = P.metalD; [[-34, -6], [-29, -3], [26, -4], [30, -2]].forEach(([a, b]) => c.fillRect(a, b, 1.6, 1.6));
  // kokpit
  c.fillStyle = P.glass; c.beginPath(); c.arc(0, -14, 15, Math.PI, TAU); c.fill();
  c.fillStyle = P.hull2; c.beginPath(); c.arc(0, -12, 7, 0, TAU); c.fill();
  c.fillStyle = P.ui; c.fillRect(-5, -15, 10, 4);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-6, -21, 3.5, 0, TAU); c.fill();
  // anten + ışık
  c.strokeStyle = P.metalD; c.lineWidth = 2; c.beginPath(); c.moveTo(20, -14); c.lineTo(26, -28); c.stroke();
  c.fillStyle = Math.sin(t * 5) > 0 ? P.bad : P.tankD; c.beginPath(); c.arc(26, -29, 2.6, 0, TAU); c.fill();
  // vinç yuvası
  c.fillStyle = P.metalD; c.fillRect(-7, 18, 14, 8);
  c.restore();
};

Art.claw = (c, x, y, ang, open, P) => {
  c.save(); c.translate(x, y); c.rotate(-ang);
  c.fillStyle = P.metalD; c.fillRect(-7, -5, 14, 8);
  c.strokeStyle = P.metal; c.lineWidth = 4; c.lineCap = 'round';
  [-1, 1].forEach(sd => { c.save(); c.rotate(sd * open); c.beginPath(); c.moveTo(sd * 5, 2); c.quadraticCurveTo(sd * 15, 10, sd * 6, 20); c.stroke(); c.restore(); });
  c.fillStyle = P.warn; c.fillRect(-2, -4, 4, 3);
  c.restore();
};

/* ---------- items ---------- */
function poly(c, pts) { c.beginPath(); pts.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); }
function nut(c, x, y, r, P) {
  c.fillStyle = P.metal; c.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill(); c.fillStyle = P.metalD; c.beginPath(); c.arc(x, y, r * .42, 0, TAU); c.fill();
}
function rockShape(c, it, P) {
  c.save(); c.translate(it.x, it.y); c.rotate(it.rot || 0);
  c.fillStyle = P.rockD; c.beginPath();
  (it.poly || [1, .9, 1, .85, 1, .95, .9, 1, .9]).forEach((m, i, a) => { const an = i / a.length * TAU; const px = Math.cos(an) * it.r * m, py = Math.sin(an) * it.r * m; i ? c.lineTo(px, py) : c.moveTo(px, py); });
  c.closePath(); c.fill();
  c.fillStyle = P.rock; c.beginPath();
  (it.poly || [1, .9, 1, .85, 1, .95, .9, 1, .9]).forEach((m, i, a) => { const an = i / a.length * TAU; const px = Math.cos(an) * it.r * m * .9 - 2, py = Math.sin(an) * it.r * m * .9 - 2; i ? c.lineTo(px, py) : c.moveTo(px, py); });
  c.closePath(); c.fill();
  c.fillStyle = P.rockD; [[.3, -.2, .22], [-.35, .25, .16], [.1, .45, .12]].forEach(([a, b, rr]) => { c.beginPath(); c.arc(a * it.r, b * it.r, rr * it.r, 0, TAU); c.fill(); });
  c.restore();
}
function gem(c, x, y, r, col, col2, t, glow = true) {
  if (glow) { c.globalAlpha = .22 + .12 * Math.sin(t * 4); c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 1.7, 0, TAU); c.fill(); c.globalAlpha = 1; }
  c.fillStyle = col2; poly(c, [[x, y - r * 1.3], [x + r, y - r * .3], [x + r * .6, y + r], [x - r * .6, y + r], [x - r, y - r * .3]]); c.fill();
  c.fillStyle = col; poly(c, [[x, y - r * 1.3], [x + r * .55, y - r * .3], [x, y + r * .7], [x - r * .55, y - r * .3]]); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - r * .35, y - r * .7, r * .25, r * .35);
}

Art.item = (c, it, t, P) => {
  const { x, y, r } = it;
  switch (it.kind) {
    case 'bolts': nut(c, x - 6, y + 3, 7, P); nut(c, x + 6, y + 5, 6.5, P); nut(c, x + 1, y - 5, 6.5, P);
      c.strokeStyle = P.metalL; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 10, y - 8); c.lineTo(x - 2, y - 12); c.stroke(); break;
    case 'plate': c.save(); c.translate(x, y); c.rotate(it.rot || 0);
      c.fillStyle = P.metalD; c.fillRect(-r, -r * .62 + 3, r * 2, r * 1.24);
      c.fillStyle = P.metal; c.fillRect(-r, -r * .62, r * 2, r * 1.24);
      c.fillStyle = P.metalD; [[-r + 4, -r * .62 + 4], [r - 6, -r * .62 + 4], [-r + 4, r * .62 - 6], [r - 6, r * .62 - 6]].forEach(([a, b]) => c.fillRect(a, b, 2.5, 2.5));
      c.fillRect(-r + 6, -1, r * 2 - 12, 2); c.restore(); break;
    case 'sat': c.save(); c.translate(x, y); c.rotate(it.rot || 0);
      c.fillStyle = P.crystal; c.globalAlpha = .9;
      [-1, 1].forEach(sd => { c.fillRect(sd > 0 ? 11 : -33, -8, 22, 16); }); c.globalAlpha = 1;
      c.strokeStyle = P.ui; c.lineWidth = 1;
      [-1, 1].forEach(sd => { const x0 = sd > 0 ? 11 : -33; for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x0 + i * 7.3, -8); c.lineTo(x0 + i * 7.3, 8); c.stroke(); } c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 22, 0); c.stroke(); });
      c.fillStyle = P.metal; c.fillRect(-11, -13, 22, 26); c.fillStyle = P.box; c.fillRect(-11, -13, 22, 5);
      c.fillStyle = P.metalD; c.beginPath(); c.arc(0, 18, 7, Math.PI, TAU); c.fill(); c.fillRect(-1, 13, 2, 5);
      c.restore(); break;
    case 'part': c.save(); c.translate(x, y); c.rotate((it.rot || 0) + t * .3);
      c.fillStyle = P.metalD; for (let i = 0; i < 8; i++) { c.save(); c.rotate(i / 8 * TAU); c.fillRect(-3, -r, 6, 6); c.restore(); }
      c.fillStyle = P.metal; c.beginPath(); c.arc(0, 0, r * .72, 0, TAU); c.fill();
      c.fillStyle = P.hull; c.beginPath(); c.arc(0, 0, r * .3, 0, TAU); c.fill(); c.restore(); break;
    case 'rock': case 'boulder': rockShape(c, it, P); break;
    case 'crystal': gem(c, x, y, r, P.crystal, P.crystal2, t + (it.seed || 0)); break;
    case 'box': c.save(); c.translate(x, y); c.rotate((it.rot || 0) * .5);
      c.fillStyle = P.boxD; c.fillRect(-r, -r * .8 + 3, r * 2, r * 1.6);
      c.fillStyle = P.box; c.fillRect(-r, -r * .8, r * 2, r * 1.6);
      c.fillStyle = P.ui; for (let i = -r; i < r; i += 8) { c.beginPath(); c.moveTo(i, -r * .8); c.lineTo(i + 4, -r * .8); c.lineTo(i + 1, -r * .8 + 5); c.lineTo(i - 3, -r * .8 + 5); c.fill(); }
      c.fillStyle = P.ui; c.font = `bold ${r * 1.1}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 3);
      c.restore();
      if (it.radar) { c.save(); c.globalAlpha = .9; c.fillStyle = P.ui; c.fillRect(x - 13, y - r - 22, 26, 16); c.fillStyle = P.accent; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.radar, x, y - r - 14); c.restore(); }
      break;
    case 'bug': { c.save(); c.translate(x, y); c.scale(it.vx > 0 ? 1 : -1, 1);
      const wig = Math.sin(t * 18 + (it.seed || 0)) * 3;
      c.strokeStyle = P.bugD; c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 5, 2); c.lineTo(i * 6 + wig * (i % 2 ? 1 : -1), 11); c.stroke(); c.beginPath(); c.moveTo(i * 5, -2); c.lineTo(i * 6 - wig, -11); c.stroke(); }
      c.fillStyle = P.bug; c.beginPath(); c.ellipse(0, 0, r, r * .7, 0, 0, TAU); c.fill();
      c.fillStyle = P.bugD; c.fillRect(-1, -r * .7, 2, r * 1.4);
      c.fillStyle = P.metalL; c.beginPath(); c.arc(r * .8, -3, 3, 0, TAU); c.arc(r * .8, 3, 3, 0, TAU); c.fill();
      c.fillStyle = P.ui; c.fillRect(r * .8, -4, 1.6, 1.6); c.fillRect(r * .8, 2, 1.6, 1.6);
      c.restore(); break; }
    case 'slime': { c.save(); c.translate(x, y);
      const sq = 1 + Math.sin(t * 5 + (it.seed || 0)) * .08;
      c.fillStyle = P.slimeD; c.beginPath(); c.ellipse(0, 4, r * 1.1 / sq, r * .8 * sq, 0, 0, TAU); c.fill();
      c.fillStyle = P.slime; c.beginPath(); c.ellipse(0, 2, r / sq, r * .72 * sq, 0, 0, TAU); c.fill();
      c.fillStyle = P.metalL; c.beginPath(); c.arc(-5, 2, 3, 0, TAU); c.arc(5, 2, 3, 0, TAU); c.fill();
      c.fillStyle = P.ui; const lk = it.vx > 0 ? 1 : -1; c.fillRect(-5 + lk, 1, 2, 2); c.fillRect(5 + lk, 1, 2, 2);
      gem(c, 0, -r * .75, 6, P.crystal, P.crystal2, t, false);
      c.restore(); break; }
    case 'tank': { c.save(); c.translate(x, y); c.rotate((it.rot || 0) * .5);
      c.fillStyle = P.tankD; c.fillRect(-r * .75, -r + 3, r * 1.5, r * 2);
      c.fillStyle = P.tank; c.fillRect(-r * .75, -r, r * 1.5, r * 2);
      c.fillStyle = P.warn; c.fillRect(-r * .75, -3, r * 1.5, 6);
      c.fillStyle = P.ui; for (let i = -r * .75; i < r * .75; i += 6) c.fillRect(i, -3, 3, 6);
      c.fillStyle = P.metalD; c.fillRect(-4, -r - 5, 8, 5);
      const on = Math.sin(t * 7 + (it.seed || 0)) > 0; c.fillStyle = on ? P.warn : P.tankD; c.beginPath(); c.arc(0, -r - 6, 2.8, 0, TAU); c.fill();
      c.restore(); break; }
    case 'relic': { const hue = (SS.RELICS[it.relic] || {}).hue || P.accent;
      c.globalAlpha = .25 + .15 * Math.sin(t * 3); c.fillStyle = P.accent; c.beginPath(); c.arc(x, y, r * 1.8, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.fillStyle = P.boxD; c.fillRect(x - r, y + r * .4, r * 2, r * .6);
      c.fillStyle = hue; c.beginPath(); c.moveTo(x - r * .7, y + r * .45); c.quadraticCurveTo(x - r, y - r * .6, x, y - r * 1.1); c.quadraticCurveTo(x + r, y - r * .6, x + r * .7, y + r * .45); c.fill();
      c.fillStyle = P.ui; c.fillRect(x - 3, y - 4, 2, 2); c.fillRect(x + 1, y - 4, 2, 2);
      break; }
    case 'debris': c.fillStyle = P.metalD; poly(c, [[x - 7, y - 3], [x + 2, y - 7], [x + 8, y + 2], [x - 2, y + 7]]); c.fill(); break;
  }
};


/* ---------- scene extras, extra items and creatures ---------- */

const { rnd, pick, clamp } = SS;
const SCENE_HUES = [['#ff9a5c', '#7a2e3b'], ['#7ee0ff', '#1d3b78'], ['#c49bff', '#3d1f6e'], ['#9cf08a', '#1f5b46'], ['#ffd36b', '#7a4b1d']];
function mkScene(zoneId) {
  const [a, b] = pick(SCENE_HUES);
  return { planet: Math.random() < .7 ? { x: rnd(.1, .9), y: rnd(.18, .45), r: rnd(18, 54), a, b, ring: Math.random() < .45, tilt: rnd(-.5, .5) } : null,
    moon: Math.random() < .5 ? { x: rnd(.05, .95), y: rnd(.2, .35), r: rnd(5, 10) } : null,
    comet: Math.random() < .5 ? { x: rnd(.2, .9), y: rnd(.18, .3), ang: rnd(2.4, 2.9), len: rnd(40, 90) } : null,
    station: zoneId !== 'lost' && Math.random() < .35 ? { x: rnd(.15, .85), y: rnd(.22, .4) } : null,
    aurora: Math.random() < .35 ? { y: rnd(.3, .6), hue: pick([a, b]) } : null,
    snow: Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(.4, 1.2) })) };
}
function drawScene(c, W, H, t, P, sc, V) {
  if (sc.aurora) { c.globalAlpha = .12; c.fillStyle = sc.aurora.hue; c.beginPath(); c.moveTo(0, sc.aurora.y * H);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, sc.aurora.y * H + Math.sin(x * .02 + t * .4) * 18); c.lineTo(W, sc.aurora.y * H + 70); c.lineTo(0, sc.aurora.y * H + 70); c.fill(); c.globalAlpha = 1; }
  if (sc.planet) { const p = sc.planet, x = p.x * W, y = p.y * H, gr = c.createRadialGradient(x - p.r * .35, y - p.r * .35, p.r * .1, x, y, p.r);
    gr.addColorStop(0, p.a); gr.addColorStop(1, p.b); c.globalAlpha = .55; c.fillStyle = gr; c.beginPath(); c.arc(x, y, p.r, 0, TAU); c.fill();
    if (p.ring) { c.strokeStyle = p.a; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, p.r * 1.7, p.r * .35, p.tilt, 0, TAU); c.stroke(); }
    c.globalAlpha = 1; }
  if (sc.moon) { c.globalAlpha = .5; c.fillStyle = P.metalL; c.beginPath(); c.arc(sc.moon.x * W, sc.moon.y * H, sc.moon.r, 0, TAU); c.fill(); c.globalAlpha = 1; }
  if (sc.comet) { const k = sc.comet, x = k.x * W, y = k.y * H, gr = c.createLinearGradient(x, y, x - Math.cos(k.ang) * k.len, y - Math.sin(k.ang) * k.len);
    gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = gr; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(k.ang) * k.len, y - Math.sin(k.ang) * k.len); c.stroke(); }
  if (sc.station) { const x = sc.station.x * W, y = sc.station.y * H; c.globalAlpha = .4; c.fillStyle = P.metalD;
    c.fillRect(x - 18, y - 2, 36, 4); c.fillRect(x - 3, y - 10, 6, 20); c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
    if (Math.sin(t * 3) > 0) { c.fillStyle = P.bad; c.fillRect(x - 1, y - 12, 2, 2); } c.globalAlpha = 1; }
  if (V.id === 'frozen') { c.fillStyle = '#ffffff'; for (const s of sc.snow) { c.globalAlpha = .25 + s.s * .3; c.fillRect(s.x * W, ((s.y * H + t * 14 * s.s) % H), 1.5 * s.s, 1.5 * s.s); } c.globalAlpha = 1;
    c.fillStyle = 'rgba(160,220,255,.08)'; c.fillRect(0, 0, W, H); }
  if (V.id === 'storm') { c.fillStyle = 'rgba(255,90,60,.06)'; c.fillRect(0, 0, W, H); }
}
// Yeni eşyaların çizimi
const itemBase = Art.item;
Art.item = (c, it, t, P) => {
  const { x, y, r } = it;
  switch (it.kind) {
    case 'gold': itemBase(c, { ...it, kind: 'rock' }, t, P);
      c.save(); c.translate(x, y); c.rotate(it.rot || 0); c.strokeStyle = P.accent === P.warn ? '#ffd35a' : '#ffd35a'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-r * .6, -r * .2); c.lineTo(-r * .1, r * .1); c.lineTo(r * .5, -r * .3); c.moveTo(-r * .2, r * .5); c.lineTo(r * .3, r * .3); c.stroke();
      const sp = .5 + .5 * Math.sin(t * 4 + (it.seed || 0)); c.fillStyle = '#fff6c4'; c.globalAlpha = sp; c.fillRect(r * .3 - 1, -r * .4, 3, 3); c.globalAlpha = 1; c.restore(); return;
    case 'ice': c.save(); c.translate(x, y); c.rotate(it.rot || 0);
      c.fillStyle = 'rgba(190,240,255,.9)'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .9, -r * .2); c.lineTo(r * .6, r * .8); c.lineTo(-r * .5, r * .9); c.lineTo(-r, 0); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(-r * .3, -r * .5); c.lineTo(r * .2, -r * .6); c.lineTo(-r * .1, -r * .1); c.fill();
      c.strokeStyle = 'rgba(80,170,220,.8)'; c.lineWidth = 1; c.stroke(); c.restore(); return;
    case 'jelly': { const ch = it.charged, bob = Math.sin(t * 2 + (it.seed || 0)) * 2;
      if (ch) { c.globalAlpha = .35; c.fillStyle = P.crystal; c.beginPath(); c.arc(x, y + bob, r * 1.8, 0, TAU); c.fill(); c.globalAlpha = 1; }
      c.strokeStyle = ch ? P.crystal : P.slime; c.lineWidth = 1.6;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 4, y + bob + 2); c.quadraticCurveTo(x + i * 4 + Math.sin(t * 4 + i) * 4, y + bob + 12, x + i * 4 + Math.sin(t * 3 + i) * 3, y + bob + 20); c.stroke(); }
      c.fillStyle = ch ? 'rgba(126,243,255,.85)' : 'rgba(193,123,255,.75)'; c.beginPath(); c.ellipse(x, y + bob, r, r * .75, 0, Math.PI, TAU); c.quadraticCurveTo(x, y + bob + 6, x - r, y + bob); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - r * .35, y + bob - r * .35, r * .25, r * .15, -.5, 0, TAU); c.fill(); return; }
    case 'egg': { const gl = .4 + .3 * Math.sin(t * 2.5 + (it.seed || 0));
      c.globalAlpha = gl; c.fillStyle = P.slime; c.beginPath(); c.arc(x, y, r * 1.5, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.fillStyle = '#e9f2d0'; c.beginPath(); c.ellipse(x, y, r * .8, r, it.rot || 0, 0, TAU); c.fill();
      c.fillStyle = P.slimeD; [[-3, -4], [3, 1], [-2, 5], [4, -6]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a, y + b, 1.8, 0, TAU); c.fill(); }); return; }
    case 'amber': { const gr = c.createRadialGradient(x - 3, y - 3, 1, x, y, r); gr.addColorStop(0, '#ffe7a1'); gr.addColorStop(1, '#d9781e');
      c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, r, r * .8, it.rot || 0, 0, TAU); c.fill();
      c.globalAlpha = .5 + .5 * Math.sin(t * 3); c.fillStyle = '#fff'; c.fillRect(x - 4, y - 5, 2, 2); c.globalAlpha = 1; return; }
    case 'mimic': itemBase(c, { ...it, kind: 'box' }, t, P);
      if (it.teeth) { c.save(); c.translate(x, y); c.fillStyle = '#fff'; for (let i = -r + 2; i < r - 2; i += 5) { c.beginPath(); c.moveTo(i, r * .1); c.lineTo(i + 2.5, r * .45); c.lineTo(i + 5, r * .1); c.fill(); }
        c.fillStyle = P.bad; c.fillRect(-r * .5, -r * .45, 3, 3); c.fillRect(r * .3, -r * .45, 3, 3); c.restore(); } return;
  }
  itemBase(c, it, t, P);
};
// Yaratıklar ve tehlikeler
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, k = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1); return Math.hypot(px - ax - k * dx, py - ay - k * dy); };
function drawEel(c, e, t, P) {
  c.lineCap = 'round';
  for (let i = 9; i >= 0; i--) { const x = e.x - e.dir * i * 7, y = e.y + Math.sin(t * 6 - i * .7 + e.ph) * 6, w = 9 - i * .6;
    c.fillStyle = i % 2 ? P.crystal2 : P.slime; c.beginPath(); c.arc(x, y, w, 0, TAU); c.fill(); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(e.x + e.dir * 3, e.y + Math.sin(t * 6 + e.ph) * 6 - 3, 2.6, 0, TAU); c.fill();
  c.fillStyle = P.space0; c.beginPath(); c.arc(e.x + e.dir * 3.6, e.y + Math.sin(t * 6 + e.ph) * 6 - 3, 1.2, 0, TAU); c.fill();
}
function drawDrone(c, d, t, P) {
  c.save(); c.translate(d.x, d.y);
  c.strokeStyle = P.metalL; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, -6); c.lineTo(14, -6); c.stroke();
  c.fillStyle = P.metalL; c.globalAlpha = .6; [-14, 14].forEach(x => { c.beginPath(); c.ellipse(x, -7, 6, 1.6 + Math.abs(Math.sin(t * 30)) * 1.2, 0, 0, TAU); c.fill(); }); c.globalAlpha = 1;
  c.fillStyle = P.tankD; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = P.bad; c.beginPath(); c.arc(0, 1, 3, 0, TAU); c.fill();
  c.strokeStyle = P.metal; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, 7); c.lineTo(-6, 13); c.moveTo(4, 7); c.lineTo(6, 13); c.stroke();
  if (d.hover > 0 && !d.carry) { c.strokeStyle = P.bad; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, d.hover / 2.6)); c.stroke(); }
  c.restore();
  if (d.carry) SS.Art.item(c, { ...d.carry, x: d.x, y: d.y + 18 }, t, P);
}
function drawWhale(c, w, t, P) {
  c.save(); c.translate(w.x, w.y); c.globalAlpha = .55;
  c.fillStyle = P.metalD; c.beginPath(); c.ellipse(0, 0, 90, 32, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-80, 0); c.lineTo(-130, -26 + Math.sin(t * 1.5) * 8); c.lineTo(-122, 0); c.lineTo(-130, 26 + Math.sin(t * 1.5) * 8); c.closePath(); c.fill();
  c.fillStyle = P.metal; c.beginPath(); c.ellipse(10, 12, 70, 14, 0, 0, Math.PI); c.fill();
  c.fillStyle = P.crystal; c.globalAlpha = .7; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-50 + i * 20, -14 + Math.sin(i) * 4, 2, 0, TAU); c.fill(); }
  c.fillStyle = '#fff'; c.globalAlpha = .8; c.beginPath(); c.arc(60, -6, 3.5, 0, TAU); c.fill();
  c.restore(); c.globalAlpha = 1;
}
Art.mkScene = mkScene; Art.drawScene = drawScene; Art.drawEel = drawEel; Art.drawDrone = drawDrone; Art.drawWhale = drawWhale; Art.segDist = segDist;
})(window.SS);
