// Space Scrapper (CrazyGames edition) — aim-and-fire salvage dives with client orders, run modules, garage, menus.
// Creatures, zones and field conditions are adapted from the original Space Scrapper scrap hunt.
(function(SS){
const { rnd, rint, pick, clamp } = SS;
const TAU = Math.PI * 2, MIN = 22;
const $ = id => document.getElementById(id);
const Art = SS.Art, P = () => Art.P(), PL = SS.Platform;

/* =====================================================================
   META (persistent)
   ===================================================================== */
const UPS = [
  { id: 'claw', cost: [20, 45, 80, 130, 200] }, { id: 'winch', cost: [20, 45, 80, 130, 200] }, { id: 'magnet', cost: [25, 55, 95, 150, 220] },
  { id: 'time', cost: [30, 65, 110, 170, 250] }, { id: 'hull', cost: [80, 180] }, { id: 'broker', cost: [30, 70, 130] },
];
const defMeta = () => ({ v: 2, best: 0, bestDive: 0, parts: 0, runs: 0, up: Object.fromEntries(UPS.map(u => [u.id, 0])), muted: false, music: true, tut: false });
const meta = SS.meta = defMeta();
const loadMeta = () => {
  const m = PL.load();
  if (!m || typeof m !== 'object') return;
  for (const k of ['best', 'parts', 'runs']) if (Number.isFinite(m[k]) && m[k] >= 0) meta[k] = Math.floor(m[k]);
  const bd = Number.isFinite(m.bestDive) ? m.bestDive : m.bestLevel; if (Number.isFinite(bd) && bd >= 0) meta.bestDive = Math.floor(bd);
  if (m.up && typeof m.up === 'object') for (const u of UPS) if (Number.isFinite(m.up[u.id])) meta.up[u.id] = clamp(Math.floor(m.up[u.id]), 0, u.cost.length);
  meta.muted = m.muted === true; meta.music = m.music !== false; meta.tut = m.tut === true;
};
const saveMeta = () => PL.save(meta);
const T = () => SS.TEXT.en; // English only
const money = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* =====================================================================
   RUN AND DIVE RULES
   ===================================================================== */
const zoneFor = d => SS.ZONES[Math.floor((d - 1) / 3) % SS.ZONES.length];
const loopFor = d => Math.pow(1.25, Math.floor((d - 1) / 15)); // after the fifth zone the field loops, richer
const needFor = d => d === 1 ? 0 : d <= 3 ? 1 : d <= 9 ? 2 : 3; // orders needed to avoid hull damage
let R = null; // current run

function pickVariant(zoneId, prev, d) {
  if (d <= 2) return SS.VARIANTS[0];
  const L = SS.VARIANTS.filter(v => (v.w[zoneId] || 0) > 0 && v.id !== prev);
  let r = Math.random() * L.reduce((a, v) => a + v.w[zoneId], 0);
  for (const v of L) { r -= v.w[zoneId]; if (r <= 0) return v; }
  return L[0];
}
const mod = id => (R && R.mods[id]) || 0;

/* =====================================================================
   DIVE ENGINE
   ===================================================================== */
let G = null; // current dive (or the menu's demo field)
const cv = () => $('game');
function layout() {
  const st = $('stage'), cw = st.clientWidth, ch = st.clientHeight, hud = ($('hud') && !$('hud').hidden && $('hud').offsetHeight) || 0;
  let W, H;
  // the playfield takes the screen's aspect ratio (no black bars); landscape uses a shorter field so everything reads bigger
  if (cw / ch < .78) { W = 360; H = clamp(Math.round(360 * ch / cw), 460, 900); }
  else { H = 470; W = clamp(Math.round(470 * cw / ch), 400, 1100); }
  const s = Math.min(cw / W, ch / H);
  return { W, H, s, cw, ch, top: Math.ceil(hud / s), land: cw / ch >= .78 };
}
function fitCanvas() {
  const L = layout(), c = cv();
  c.style.width = Math.floor(L.W * L.s) + 'px'; c.style.height = Math.floor(L.H * L.s) + 'px';
  const { ctx } = Art.setup(c, L.W, L.H, 1);
  return { ...L, ctx };
}

function newDive(demo) {
  const d = demo ? 1 : R.dive, Z = zoneFor(d), L = fitCanvas();
  const V = demo ? SS.VARIANTS[0] : pickVariant(Z.id, R.lastVar, d); if (!demo) R.lastVar = V.id;
  const top = demo ? 8 : L.top, OY = top + 74, shipY = top + 36;
  const tutorial = !demo && d === 1 && !meta.tut;
  const g = {
    demo, W: L.W, H: L.H, s: L.s, land: L.land, ctx: L.ctx, OX: L.W / 2, OY, shipY, Z, V, loop: loopFor(d), dive: d,
    earned: 0, items: [], actors: [], warns: [], fx: SS.FX.make(), stars: Art.makeStars(Math.round(80 * L.W / 360), L.W, L.H),
    hook: { angle: 0, len: MIN, st: 'idle', held: null }, aim: 0, aimV: 0, scene: Art.mkScene(Z.id),
    timeMax: d === 1 ? 60 : 50 - Math.min(15, d - 2) + meta.up.time * 4 + mod('oxygen') * 6, t: 0, shake: 0, endT: -1, intro: demo ? 0 : 2.6,
    reach: 7 + meta.up.magnet * 3 + mod('coil') * 4, extendSp: (7 + meta.up.claw * 1.1) * (1 + mod('motor') * .2), winch: (1 + meta.up.winch * .2) * (1 + mod('winch') * .25),
    meteorT: 3, eelT: 2, droneT: 3, got: 0, chainCat: null, chainN: 0, shipScale: L.land ? 1.2 : 1,
    amp: 1.3, orders: [], tut: tutorial ? { step: 0, t: 0 } : null,
    bottom: L.land || demo ? 0 : Math.round(165 / L.s), // portrait: the orders panel sits at the bottom
  };
  g.time = g.timeMax;
  spawn(g);
  if (V.id === 'drift') for (const it of g.items) if (!it.vx) it.vx = (it.y % 2 < 1 ? -1 : 1) * rnd(.22, .42) / Math.max(1, it.wt * .5);
  if (V.id === 'whale') g.actors.push({ type: 'whale', x: -150, y: rnd(g.OY + 170, g.OY + 260), vx: .55, dropped: false });
  if (!demo) g.orders = makeOrders(g);
  if (g.tut) g.tut.target = tutTarget(g);
  return g;
}
const valueOf = (g, kind) => {
  const T0 = SS.ITEMS[kind]; let v = T0.val * g.Z.mult * g.loop * .5;
  if (SS.catOf(kind) === 'mineral') v *= 1 + mod('recycler') * .6;
  return Math.round(v);
};
function mk(g, kind, x, y) {
  const T0 = SS.ITEMS[kind];
  const it = { kind, x, y, r: T0.r, wt: T0.wt, rot: rnd(-.5, .5), seed: Math.random() * 10 };
  if (kind === 'rock' || kind === 'boulder') it.poly = Array.from({ length: 9 }, () => rnd(.78, 1.08));
  if (kind === 'gold') it.poly = Array.from({ length: 9 }, () => rnd(.8, 1.06));
  if (kind === 'jelly') it.by = y;
  if (T0.move) it.vx = (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.2);
  return it;
}
function spawn(g) {
  const { W, H, OY } = g, y0 = OY + 70, y1 = H - 14 - g.bottom, depth = y1 - y0;
  const area = g.area = clamp((W * depth) / (360 * 400), 1, 3.2);
  const mix = {};
  for (const [k, n] of Object.entries(g.Z.mix)) { const x = n * area; mix[k] = Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); }
  for (const [k, n] of Object.entries(SS.ZONE_EXTRA[g.Z.id] || {})) if (Math.random() < n) mix[k] = (mix[k] || 0) + 1;
  if (g.V.mix) g.V.mix(mix);
  if (g.dive <= 2) { mix.tank = 0; mix.mimic = 0; }
  else if (g.dive >= 4) { mix.tank = (mix.tank || 0) + Math.min(3, Math.floor(g.dive / 4)); mix.mimic = (mix.mimic || 0) + (g.dive >= 6 ? 1 : 0); }
  if (g.dive === 1) { mix.bolts = Math.max(mix.bolts || 0, 4); mix.plate = Math.max(mix.plate || 0, 3); }
  const band = { sat: [.3, 1], boulder: [.28, 1], crystal: [.5, 1], slime: [.38, .93], tank: [.2, .93], gold: [.38, 1], egg: [.5, 1], jelly: [.11, .84], mimic: [.18, .93], amber: [.4, 1], bolts: [0, .7] };
  const order = ['sat', 'boulder', 'gold', 'plate', 'part', 'box', 'mimic', 'egg', 'crystal', 'rock', 'ice', 'bolts', 'tank', 'bug', 'jelly', 'slime'];
  for (const kind of order) {
    const T0 = SS.ITEMS[kind], [b0, b1] = band[kind] || [0, 1];
    for (let i = 0; i < (mix[kind] || 0); i++) for (let k = 0; k < 150; k++) {
      const x = 16 + T0.r + Math.random() * (W - 32 - 2 * T0.r), y = y0 + (b0 + Math.random() * (b1 - b0)) * depth;
      if (y + T0.r > y1 + 10) continue;
      if (g.land && !g.demo && x - T0.r < 275 / g.s && y - T0.r < 250 / g.s) continue; // under the orders panel
      if (Math.atan2(Math.abs(x - g.OX), y - OY) > g.amp - .05) continue; // only where the claw can reach
      if (g.items.every(o => Math.hypot(o.x - x, o.y - y) > o.r + T0.r + 8)) { g.items.push(mk(g, kind, x, y)); break; }
    }
  }
}

/* ---------- orders ---------- */
const COMMON = ['bolts', 'plate', 'part', 'ice', 'rock'], RARE = ['crystal', 'gold', 'sat', 'slime', 'egg', 'jelly', 'box', 'boulder'];
function makeOrders(g) {
  const cnt = {}; for (const it of g.items) cnt[it.kind] = (cnt[it.kind] || 0) + 1;
  const pay = v => Math.round(v * (1 + mod('broker') * .2) * (1 + meta.up.broker * .08) / 5) * 5;
  const kindOrder = (kind, n) => ({ type: 'kind', kind, n, got: 0, done: false, reward: pay(valueOf(g, kind) * n * 1.4 + 30 * Math.sqrt(g.dive)) });
  if (g.dive === 1) return [kindOrder('bolts', 2), kindOrder('plate', 1), { type: 'cat', cat: 'metal', n: 120, got: 0, done: false, reward: pay(90) }];
  const O = [], used = new Set(), d = g.dive, n = clamp(Math.round((1 + Math.floor(d / 3)) * (1 + (g.area - 1) * .3)), 1, 6);
  const c1 = COMMON.filter(k => (cnt[k] || 0) >= n + 1);
  if (c1.length) { const k = pick(c1); used.add(k); O.push(kindOrder(k, n)); }
  const c2 = RARE.filter(k => !used.has(k) && (cnt[k] || 0) >= 1);
  if (c2.length) { const k = pick(c2); used.add(k); O.push(kindOrder(k, clamp(Math.floor(d / 4) + 1, 1, Math.min(3, cnt[k])))); }
  const catVal = c => g.items.filter(it => SS.catOf(it.kind) === c).reduce((a, it) => a + valueOf(g, it.kind), 0);
  const cats = Object.keys(SS.CATS).filter(c => catVal(c) >= 120).sort(() => Math.random() - .5);
  if (cats.length) { const c = cats[0], amt = Math.max(60, Math.round(catVal(c) * Math.min(.75, .25 + d * .045) / 10) * 10); O.push({ type: 'cat', cat: c, n: amt, got: 0, done: false, reward: pay(amt * .9) }); }
  while (O.length < 3) { const k = COMMON.concat(RARE).find(k => !used.has(k) && (cnt[k] || 0) >= 1); if (!k) break; used.add(k); O.push(kindOrder(k, 1)); }
  return O;
}
const orderLabel = o => o.type === 'kind' ? T().order.kind(o.n, T().items[o.kind]) : T().order.cat(money(o.n), SS.CATS[o.cat].name);
const fitsOrder = (g, kind) => g.orders.some(o => !o.done && (o.type === 'kind' ? o.kind === kind : SS.catOf(kind) === o.cat));

/* ---------- aiming ---------- */
const dirOf = a => ({ x: Math.sin(a), y: Math.cos(a) });
const tip = g => ({ x: g.OX + Math.sin(g.hook.angle) * g.hook.len, y: g.OY + Math.cos(g.hook.angle) * g.hook.len });
// first item the claw would touch when fired at angle a (same rule as the real grab), and where
function aimHit(g, a) {
  const d = dirOf(a); let best = null, bestL = Infinity;
  for (const it of g.items) {
    const vx = it.x - g.OX, vy = it.y - g.OY, along = vx * d.x + vy * d.y, perp = Math.abs(vx * d.y - vy * d.x), R0 = it.r + g.reach;
    if (along <= 0 || perp >= R0) continue;
    const l = along - Math.sqrt(R0 * R0 - perp * perp);
    if (l < bestL) { bestL = l; best = it; }
  }
  // where the ray leaves the field
  const tx = d.x > 0 ? (g.W - g.OX) / d.x : d.x < 0 ? -g.OX / d.x : Infinity, ty = (g.H - g.OY) / d.y, edge = Math.min(tx, ty);
  return { it: best, len: best ? Math.max(MIN, bestL) : edge };
}
function setAimAt(g, x, y) { if (y > g.OY + 8) g.aim = clamp(Math.atan2(x - g.OX, y - g.OY), -g.amp, g.amp); }

function blowTank(g, m) {
  SS.FX.burst(g.fx, m.x, m.y, ['#ffcf5a', '#ff8a3d', '#ff4b3a', '#fff3c4'], 70, 6);
  g.shake = 14; SS.sfx('boom');
  const hit = g.items.filter(o => Math.hypot(o.x - m.x, o.y - m.y) < 95);
  g.items = g.items.filter(o => !hit.includes(o));
  hit.filter(o => o.kind === 'tank').forEach(o => blowTank(g, o));
}
function grab(g, it) {
  const t = T(), C = P(), h = g.hook;
  if (((it.kind === 'jelly' && it.charged) || it.kind === 'mimic') && !mod('plating')) {
    h.st = 'retract'; const loss = it.kind === 'mimic' ? 4 : 3; g.time = Math.max(.5, g.time - loss); g.shake = 8; SS.sfx('bad');
    if (it.kind === 'mimic') { g.items = g.items.filter(o => o !== it); SS.FX.burst(g.fx, it.x, it.y, [C.box, C.bad], 24, 4); SS.FX.text(g.fx, it.x, it.y - 12, t.events.mimic, C.bad); }
    else { SS.FX.burst(g.fx, it.x, it.y, [C.crystal, '#fff'], 20, 3.5); SS.FX.text(g.fx, it.x, it.y - 12, t.events.jelly, C.crystal); }
    return;
  }
  g.items = g.items.filter(o => o !== it); h.st = 'retract';
  if (it.kind === 'tank') { blowTank(g, it); SS.FX.text(g.fx, it.x, it.y - 10, t.events.boom, C.bad); const p = tip(g); h.held = mk(g, 'debris', p.x, p.y); }
  else if (it.kind === 'mimic') { h.held = mk(g, 'debris', it.x, it.y); SS.sfx('grab'); }
  else { h.held = it; SS.sfx('grab'); }
}
function collect(g, it) {
  const t = T(), C = P(), cat = SS.catOf(it.kind);
  let v = valueOf(g, it.kind);
  if (mod('chain') && cat) { g.chainN = g.chainCat === cat ? g.chainN + 1 : 0; g.chainCat = cat; v = Math.round(v * (1 + Math.min(.5, g.chainN * .1))); }
  g.earned += v; R.cash += v; R.total += v; g.got++;
  SS.FX.text(g.fx, g.OX + 80, g.OY - 18, '+' + money(v), v >= 150 ? C.crystal : C.accent, t.items[it.kind]);
  SS.FX.burst(g.fx, g.OX, g.OY, [C.accent, C.star], 12, 2.5); SS.sfx(v >= 150 ? 'big' : 'coin');
  for (const o of g.orders) {
    if (o.done) continue;
    if (o.type === 'kind' && o.kind === it.kind) o.got++;
    else if (o.type === 'cat' && cat === o.cat) o.got += v;
    else continue;
    if (o.got >= o.n) {
      o.done = true; o.got = o.n; g.earned += o.reward; R.cash += o.reward; R.total += o.reward; R.stars++;
      SS.FX.text(g.fx, g.OX, g.OY + 60, `★ ${t.events.orderDone}`, C.good, '+' + money(o.reward)); SS.FX.burst(g.fx, g.OX, g.OY + 40, [C.good, C.accent, C.star], 36, 4); SS.sfx('win');
      if (g.orders.every(x => x.done)) PL.happytime();
    }
  }
  renderOrders();
  if (g.tut && g.tut.step < 2) { g.tut.step = 2; g.tut.t = 0; }
}
function fire() {
  const g = G; if (!g || g.demo || state !== 'play' || paused) return;
  if (g.hook.st === 'idle' && g.endT < 0 && g.intro < 2.2) { g.hook.angle = g.aim; g.hook.st = 'extend'; SS.sfx('fire'); if (g.tut && g.tut.step <= 1) { g.tut.step = 1.5; } }
}
function drop() {
  const g = G; if (!g || state !== 'play' || paused) return;
  const h = g.hook; if (h.st !== 'retract' || !h.held) return;
  const it = h.held; h.held = null;
  if (it.kind !== 'debris') { it.x = clamp(it.x, 20, g.W - 20); it.y = clamp(it.y, g.OY + 60, g.H - 20); g.items.push(it); }
  SS.FX.text(g.fx, it.x, it.y - 14, T().events.dropped, P().metalL); SS.sfx('click'); hud();
}
function cutRope(g, why) {
  const C = P(), p = tip(g), h = g.hook;
  if (h.held && h.held.kind !== 'debris') { const it = h.held; it.x = p.x; it.y = clamp(p.y + 10, g.OY + 60, g.H - 20); g.items.push(it); }
  h.held = null; h.st = 'retract'; g.shake = 6; SS.sfx('bad'); SS.FX.text(g.fx, p.x, p.y - 10, why, C.bad);
}
function stepActors(g, dt, f) {
  const C = P(), t = T(), p = tip(g), h = g.hook, ropeOut = h.st !== 'idle' && h.len > MIN + 6, V = g.V, W = g.W, H = g.H, shielded = mod('plating') > 0;
  if (V.id === 'storm') {
    g.meteorT -= dt; if (g.meteorT <= 0) { g.meteorT = rnd(2.4, 3.8) / Math.min(1.8, W / 360); g.warns.push({ x: rnd(40, W - 40), t: .9 }); }
    for (const w of g.warns) { w.t -= dt; if (w.t <= 0) { const dir = w.x < W / 2 ? 1 : -1; g.actors.push({ type: 'meteor', x: w.x, y: g.OY + 22, vx: dir * rnd(1.2, 2.4), vy: rnd(5, 6.5) }); } }
    g.warns = g.warns.filter(w => w.t > 0);
  }
  if (V.id === 'eels') { g.eelT -= dt; if (g.eelT <= 0 && g.actors.filter(a => a.type === 'eel').length < 2) { g.eelT = rnd(4, 7); const dir = Math.random() < .5 ? 1 : -1; g.actors.push({ type: 'eel', x: dir > 0 ? -60 : W + 60, y: rnd(g.OY + 110, H - 60), dir, sp: rnd(1.3, 2), ph: Math.random() * 6 }); } }
  if (V.id === 'raiders') { g.droneT -= dt; if (g.droneT <= 0 && g.actors.filter(a => a.type === 'drone').length < 2) { g.droneT = rnd(5, 8); g.actors.push({ type: 'drone', x: Math.random() < .5 ? -20 : W + 20, y: rnd(g.OY + 30, g.OY + 100), hover: 0, carry: null, tgt: null }); } }
  for (const a of g.actors) {
    if (a.type === 'meteor') {
      a.x += a.vx * f; a.y += a.vy * f;
      if (ropeOut && Art.segDist(a.x, a.y, g.OX, g.OY, p.x, p.y) < 7) { a.dead = true; SS.FX.burst(g.fx, a.x, a.y, [C.flame, C.bad], 14, 3); cutRope(g, t.events.meteor); }
      if (a.y > H + 20) a.dead = true;
    } else if (a.type === 'eel') {
      a.x += a.dir * a.sp * f; const hy = a.y + Math.sin(g.t * 6 + a.ph) * 6;
      if (!shielded && h.st === 'extend' && Math.hypot(p.x - a.x, p.y - hy) < 18) { h.st = 'retract'; SS.FX.text(g.fx, a.x, hy - 14, t.events.eelPush, C.crystal2); SS.sfx('bad'); }
      else if (!shielded && h.st === 'retract' && h.held && h.held.kind !== 'debris' && Art.segDist(a.x, hy, g.OX, g.OY, p.x, p.y) < 12) { h.held = null; SS.FX.text(g.fx, a.x, hy - 14, t.events.eelSnatch, C.bad); SS.FX.burst(g.fx, a.x, hy, [C.slime, C.crystal2], 18, 3); SS.sfx('bad'); }
      if (a.x < -90 || a.x > W + 90) a.dead = true;
    } else if (a.type === 'whale') {
      a.x += a.vx * f;
      if (!a.dropped && a.x > W * .55) { a.dropped = true; g.items.push(mk(g, 'amber', a.x - 40, clamp(a.y + 50, g.OY + 150, H - 30))); SS.FX.text(g.fx, a.x - 40, a.y + 30, t.events.amber, C.accent); }
      if (a.x > W + 200) a.dead = true;
    } else if (a.type === 'drone') {
      if (Math.hypot(p.x - a.x, p.y - a.y) < 22 && h.st !== 'idle') {
        a.dead = true; SS.FX.burst(g.fx, a.x, a.y, [C.bad, C.flame, C.metalL], 30, 4.5); SS.FX.text(g.fx, a.x, a.y - 14, t.events.droneDown, C.good); SS.sfx('boom'); g.shake = 6;
        if (a.carry) { a.carry.x = a.x; a.carry.y = clamp(a.y + 20, g.OY + 60, H - 20); g.items.push(a.carry); }
        if (h.st === 'extend') h.st = 'retract'; continue;
      }
      if (a.carry) { a.y -= 1.6 * f; if (a.y < -30) a.dead = true; continue; }
      if (!a.tgt || !g.items.includes(a.tgt)) { const vals = g.items.filter(o => ['crystal', 'part', 'sat', 'gold', 'egg', 'slime', 'amber', 'plate'].includes(o.kind)); a.tgt = vals.length ? pick(vals) : null; a.hover = 0; if (!a.tgt) { a.y -= f; if (a.y < -30) a.dead = true; continue; } }
      const dx = a.tgt.x - a.x, dy = a.tgt.y - 22 - a.y, d = Math.hypot(dx, dy);
      if (d > 3) { a.x += dx / d * Math.min(d, 1.2 * f); a.y += dy / d * Math.min(d, 1.2 * f); a.hover = 0; }
      else { a.hover += dt; if (a.hover > 2.8) { a.carry = a.tgt; g.items = g.items.filter(o => o !== a.tgt); SS.FX.text(g.fx, a.x, a.y - 14, t.events.droneSteal, C.bad); SS.sfx('bad'); } }
    }
  }
  g.actors = g.actors.filter(a => !a.dead);
}
function update(g, dt) {
  const f = dt * 60, h = g.hook;
  g.t += dt; SS.FX.step(g.fx, dt, f);
  if (g.shake > 0) g.shake = Math.max(0, g.shake - f * .8);
  g.intro = Math.max(0, g.intro - dt);
  if (g.aimV) g.aim = clamp(g.aim + g.aimV * .028 * f, -g.amp, g.amp);
  if (g.demo) { // menu background: the claw picks things by itself
    g.aim = Math.sin(g.t * .5) * g.amp * .8;
    if (h.st === 'idle' && g.t % 3 < dt && g.items.length > 6) { h.angle = g.aim; h.st = 'extend'; }
  }
  if (g.tut) tutStep(g, dt);
  if (g.endT >= 0) { g.endT -= dt; if (g.endT <= 0) endDive(); return; }
  if (!g.demo) { g.time -= dt; if (g.time <= 0) { g.time = 0; g.endT = .6; return; } }
  for (const it of g.items) if (it.vx) { it.x += it.vx * f; if (it.x < 22 || it.x > g.W - 22) { it.vx *= -1; it.x = clamp(it.x, 22, g.W - 22); } }
  for (const it of g.items) {
    if (it.kind === 'jelly') { it.y = it.by + Math.sin(g.t * .9 + it.seed) * 14; it.charged = Math.sin(g.t * 1.7 + it.seed * 2) > .45; }
    else if (it.kind === 'mimic') it.teeth = Math.sin(g.t * 1.3 + it.seed) > .82;
  }
  stepActors(g, dt, f);
  if (h.st === 'idle') h.angle = g.aim;
  else if (h.st === 'extend') {
    h.len += g.extendSp * f; const p = tip(g);
    for (const it of g.items) if (Math.hypot(it.x - p.x, it.y - p.y) < it.r + g.reach) { grab(g, it); break; }
    if (h.st === 'extend' && (p.x < -5 || p.x > g.W + 5 || p.y > g.H + 5)) h.st = 'retract';
  } else {
    const sp = h.held ? (9.5 / h.held.wt) * g.winch : 13;
    h.len -= sp * f;
    if (h.held) { const p = tip(g); h.held.x = p.x + Math.sin(h.angle) * h.held.r * .8; h.held.y = p.y + Math.cos(h.angle) * h.held.r * .8; }
    if (h.len <= MIN) {
      h.len = MIN; const it = h.held; h.held = null; h.st = 'idle';
      if (it && !g.demo) { collect(g, it); if (!g.items.length) g.endT = .8; }
      if (g.demo && g.items.length < 8) { g.items = []; spawn(g); }
    }
  }
  if (!g.demo) hud();
}

/* ---------- onboarding (first dive only, skippable, done in gameplay) ---------- */
function tutTarget(g) {
  const L = g.items.filter(it => it.kind === 'bolts').sort((a, b) => Math.abs(a.x - g.OX) + a.y * .3 - (Math.abs(b.x - g.OX) + b.y * .3));
  return L.find(it => aimHit(g, Math.atan2(it.x - g.OX, it.y - g.OY)).it === it) || L[0] || null;
}
function tutStep(g, dt) {
  const tt = g.tut; tt.t += dt;
  if (tt.step === 0) { if (!tt.target || !g.items.includes(tt.target)) tt.target = tutTarget(g); const hit = aimHit(g, g.aim).it; if (tt.target && hit === tt.target) { tt.step = 1; tt.t = 0; } }
  else if (tt.step === 1.5) { if (g.hook.st === 'idle') { tt.step = 0; tt.t = 0; } }
  else if (tt.step === 1) { const hit = aimHit(g, g.aim).it; if (hit !== tt.target && g.hook.st === 'idle') { tt.step = 0; tt.t = 0; } }
  else if (tt.step === 2 && tt.t > 4.5) { tt.step = 3; tt.t = 0; }
  else if (tt.step === 3 && tt.t > 4) { endTutorial(); }
  $('orders').classList.toggle('pulse', tt.step === 2);
}
function endTutorial() { if (G && G.tut) { G.tut = null; $('orders').classList.remove('pulse'); } $('skipTut').hidden = true; if (!meta.tut) { meta.tut = true; saveMeta(); } }

/* ---------- drawing ---------- */
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function keycap(c, x, y, label, C) {
  c.font = SS.tfont(13); const w = Math.max(26, c.measureText(label).width + 14);
  c.fillStyle = '#ffffff22'; rr(c, x - w / 2, y - 13, w, 26, 6); c.fill(); c.strokeStyle = '#ffffff88'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = C.text; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y + 1);
  return w;
}
function pointerIcon(c, x, y, C, press) {
  c.save(); c.translate(x, y); c.fillStyle = C.text; c.strokeStyle = C.ui; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(6, 17); c.lineTo(10, 26); c.lineTo(14, 24); c.lineTo(10, 15); c.lineTo(17, 15); c.closePath(); c.stroke(); c.fill();
  if (press) { c.strokeStyle = C.accent; c.globalAlpha = .8; c.beginPath(); c.arc(0, 0, 10 + press * 10, 0, TAU); c.stroke(); }
  c.restore();
}
function drawTut(g, c, C) {
  const tt = g.tut, t = T(), tg = tt.target;
  const card = (title, sub) => {
    c.font = SS.tfont(20); const w = Math.max(c.measureText(title).width + 40, 230), x = g.W / 2 - w / 2, y = g.H - 92 - g.bottom;
    c.globalAlpha = .92; c.fillStyle = C.ui; rr(c, x, y, w, 70, 12); c.fill(); c.globalAlpha = 1;
    c.fillStyle = C.accent; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(title, g.W / 2, y + 28);
    if (sub) { c.font = SS.tfont(13); c.fillStyle = C.text; c.fillText(sub, g.W / 2, y + 52); }
  };
  if ((tt.step === 0 || tt.step === 1) && tg) {
    const pulse = .5 + .5 * Math.sin(g.t * 6);
    c.strokeStyle = C.accent; c.lineWidth = 3; c.globalAlpha = .6 + .4 * pulse; c.beginPath(); c.arc(tg.x, tg.y, tg.r + 10 + pulse * 4, 0, TAU); c.stroke(); c.globalAlpha = 1;
    if (tt.step === 0) {
      // the pointer glides towards the target to show "aim here"
      const k = (g.t * .6) % 1, sx = g.OX + (tg.x - g.OX) * .3, sy = g.OY + 60, px = sx + (tg.x - sx) * k, py = sy + (tg.y - sy) * k;
      pointerIcon(c, px, py, C, 0);
      card(t.tut.aim, t.keys.aim);
    } else {
      pointerIcon(c, tg.x + 6, tg.y + 6, C, (g.t * 1.5) % 1);
      card(t.tut.fire, t.keys.fire);
    }
  } else if (tt.step === 2) card(t.tut.orders, '★');
  else if (tt.step === 3) card(t.tut.drop, t.keys.drop);
}
function draw(g) {
  const c = g.ctx, C = P(), t = g.t, W = g.W, H = g.H, h = g.hook;
  c.save();
  if (g.shake > 0) c.translate(rnd(-g.shake, g.shake) * .5, rnd(-g.shake, g.shake) * .5);
  Art.space(c, W, H, t, g.Z.id, g.stars, C);
  Art.drawScene(c, W, H, t, C, g.scene, g.V);
  for (const a of g.actors) if (a.type === 'whale') Art.drawWhale(c, a, t, C);
  // soft glow behind valuable finds
  for (const it of g.items) if (SS.ITEMS[it.kind].gem || it.kind === 'gold' || it.kind === 'sat') {
    const gr = c.createRadialGradient(it.x, it.y, 2, it.x, it.y, it.r * 2.2); gr.addColorStop(0, it.kind === 'gold' ? 'rgba(255,211,90,.35)' : 'rgba(94,240,255,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(it.x - it.r * 2.2, it.y - it.r * 2.2, it.r * 4.4, it.r * 4.4);
  }
  for (const it of g.items) Art.item(c, it, t, C);
  // aim guide: dotted line to the first thing the claw would touch
  if (h.st === 'idle' && !g.demo && g.endT < 0) {
    const hit = aimHit(g, g.aim), d = dirOf(g.aim), fits = hit.it && fitsOrder(g, hit.it.kind);
    c.strokeStyle = hit.it ? (fits ? C.good : C.accent) : '#ffffff66'; c.lineWidth = 2; c.setLineDash([4, 7]); c.lineDashOffset = -t * 30;
    c.beginPath(); c.moveTo(g.OX + d.x * MIN, g.OY + d.y * MIN); c.lineTo(g.OX + d.x * hit.len, g.OY + d.y * hit.len); c.stroke(); c.setLineDash([]);
    if (hit.it) {
      const it = hit.it; c.lineWidth = 2.5; c.beginPath(); c.arc(it.x, it.y, it.r + 6, 0, TAU); c.stroke();
      const lab = T().items[it.kind] + (mod('scanner') ? ` · ₡${money(valueOf(g, it.kind))}` : '') + (fits ? ' ✓' : '');
      c.font = SS.tfont(12); const w = c.measureText(lab).width + 12, lx = clamp(it.x, w / 2 + 4, W - w / 2 - 4), ly = it.y - it.r - 18;
      c.fillStyle = 'rgba(12,10,29,.82)'; rr(c, lx - w / 2, ly - 10, w, 20, 6); c.fill();
      c.fillStyle = fits ? C.good : C.text; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lab, lx, ly + 1);
    }
  }
  const bob = Math.sin(t * 1.6) * 2, p = tip(g);
  Art.ship(c, g.OX, g.shipY + bob, g.shipScale, t, C);
  c.strokeStyle = C.rope; c.lineWidth = 2.5; c.beginPath(); c.moveTo(g.OX, g.shipY + 24 + bob); c.lineTo(g.OX, g.OY); c.lineTo(p.x, p.y); c.stroke();
  c.fillStyle = C.metalD; c.beginPath(); c.arc(g.OX, g.OY, 6, 0, TAU); c.fill();
  if (h.held) Art.item(c, h.held, t, C);
  c.save(); c.translate(p.x, p.y); c.scale(1.2, 1.2); Art.claw(c, 0, 0, h.angle, h.held ? .12 : .55, C); c.restore();
  for (const a of g.actors) {
    if (a.type === 'eel') Art.drawEel(c, a, t, C); else if (a.type === 'drone') Art.drawDrone(c, a, t, C);
    else if (a.type === 'meteor') { c.fillStyle = C.flame; c.globalAlpha = .5; c.beginPath(); c.arc(a.x - a.vx * 2, a.y - a.vy * 2, 6, 0, TAU); c.fill(); c.globalAlpha = 1; c.fillStyle = C.rockD; c.beginPath(); c.arc(a.x, a.y, 5, 0, TAU); c.fill(); }
  }
  for (const w of g.warns) { c.fillStyle = C.bad; c.globalAlpha = .5 + .5 * Math.sin(t * 20); c.beginPath(); c.moveTo(w.x - 8, g.OY + 14); c.lineTo(w.x + 8, g.OY + 14); c.lineTo(w.x, g.OY + 28); c.fill(); c.globalAlpha = 1; }
  if (g.V.id === 'dark') {
    const Rr = mod('scanner') ? 160 : 115, dg = c.createRadialGradient(p.x, p.y, Rr * .35, p.x, p.y, Rr);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(4,3,12,.93)'); c.fillStyle = dg; c.fillRect(0, g.OY + 10, W, H - g.OY - 10);
    for (const it of g.items) if (SS.ITEMS[it.kind].gem || it.kind === 'gold') { c.globalAlpha = .3 + .3 * Math.sin(t * 3 + it.seed); c.fillStyle = it.kind === 'gold' ? '#ffd35a' : C.crystal; c.beginPath(); c.arc(it.x, it.y, 2, 0, TAU); c.fill(); c.globalAlpha = 1; }
  }
  SS.FX.draw(g.fx, c);
  SS.FX.drawText(g.fx, c, C);
  // vignette
  const vg = c.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .45, W / 2, H * .55, Math.max(W, H) * .8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,3,15,.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  if (g.tut) drawTut(g, c, C);
  if (g.intro > 0 && !g.tut) {
    const tx = T(), [nm, hint] = tx.var[g.V.id], bw = Math.min(W - 40, 440), bx = (W - bw) / 2, by = clamp(g.OY + 110, 0, H - 120);
    c.globalAlpha = Math.min(1, g.intro * 1.5); c.fillStyle = C.ui; rr(c, bx, by, bw, 78, 12); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = C.accent; c.font = SS.tfont(24); c.fillText(`${tx.dive(g.dive)} · ${nm}`, W / 2, by + 32);
    c.fillStyle = C.text; c.font = SS.tfont(14); c.fillText(hint, W / 2, by + 58); c.globalAlpha = 1;
  }
  c.restore();
}

/* =====================================================================
   FLOW: menu → dive → result → module pick → next dive … → summary
   ===================================================================== */
let state = 'menu', paused = false;
SS.Game = { get state() { return state; }, get paused() { return paused; }, get run() { return R; }, _dbg: () => G, _fire: () => fire(), _drop: () => drop(), _tip: g => tip(g), _value: (g, k) => valueOf(g, k), _aimHit: (g, a) => aimHit(g, a),
  // tests only: step the dive manually (the real loop then only draws)
  _next: () => nextDive(), manual: false, _step: dt => { if (G && state === 'play' && !paused) update(G, dt); }, _draw: () => { if (G) draw(G); } };
const show = id => { document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; }); $('hud').hidden = !(id === null); document.body.dataset.state = state; SS.music.update(); };
function startRun() {
  SS.audioUnlock();
  const hearts = 3 + meta.up.hull;
  R = { dive: 1, cash: 0, total: 0, stars: 0, hearts, maxHearts: hearts, mods: {}, lastVar: null, lastAd: 0, repaired: false, doubled: 0 };
  meta.runs++; saveMeta();
  startDive();
}
function startDive() {
  state = 'play'; paused = false; show(null);
  G = newDive(false); renderOrders(); hud();
  $('skipTut').hidden = !G.tut;
  PL.gameplayStart();
}
function endDive() {
  const g = G; PL.gameplayStop();
  if (g.tut || g.dive === 1) endTutorial();
  const stars = g.orders.filter(o => o.done).length, need = needFor(g.dive);
  R.lastHit = stars < need;
  if (R.lastHit) R.hearts--;
  state = R.hearts > 0 ? 'result' : 'wrecked';
  SS.sfx(R.lastHit ? 'lose' : 'win');
  renderResult();
}
async function maybeMidgame() {
  // midgame ad at natural breaks only: from dive 3 on, at most every second dive
  if (R.dive >= 3 && R.dive - R.lastAd >= 2) { R.lastAd = R.dive; await PL.ad('midgame'); }
}
function offers() { return SS.MODS.filter(m => mod(m.id) < m.max).sort(() => Math.random() - .5).slice(0, 3); }
function goPick() { state = 'pick'; R.offers = offers().map(m => m.id); R.rerolled = false; if (!R.offers.length) return nextDive(); renderPick(); }
async function nextDive() { R.dive++; await maybeMidgame(); startDive(); }
function finishRun() {
  const parts = Math.floor(R.total / 40) + R.dive * 2 + R.stars;
  const newBest = R.total > meta.best;
  meta.parts += parts; meta.best = Math.max(meta.best, R.total); meta.bestDive = Math.max(meta.bestDive, R.dive);
  saveMeta();
  return { parts, newBest };
}

/* =====================================================================
   UI
   ===================================================================== */
const iconCache = {};
function itemIcon(kind) {
  if (iconCache[kind]) return iconCache[kind];
  const c = document.createElement('canvas'), { ctx } = Art.setup(c, 36, 36, 1), T0 = SS.ITEMS[kind];
  const s = Math.min(1, 14 / T0.r); ctx.save(); ctx.translate(18, 18); ctx.scale(s, s); Art.item(ctx, { kind, x: 0, y: 0, r: T0.r, rot: .2, seed: 1, poly: Array(9).fill(.95) }, 0, P()); ctx.restore();
  return (iconCache[kind] = c.toDataURL());
}
const CAT_ICON = { metal: 'plate', mineral: 'gold', bio: 'crystal' };
function renderOrders() {
  const g = G; if (!g || g.demo) return;
  $('orders').innerHTML = `<b class="o-title">${T().orders}</b>` + g.orders.map(o => {
    const prog = o.type === 'kind' ? `${o.got}/${o.n}` : `₡${money(o.got)}/${money(o.n)}`;
    return `<div class="order ${o.done ? 'done' : ''}"><img alt="" src="${itemIcon(o.type === 'kind' ? o.kind : CAT_ICON[o.cat])}"><div><span>${esc(orderLabel(o))}</span><small>${o.done ? '✓ +₡' + money(o.reward) : prog + ' · ₡' + money(o.reward)}</small></div></div>`;
  }).join('');
}
const heartsHtml = () => '♥'.repeat(Math.max(0, R.hearts)) + `<i>${'♥'.repeat(Math.max(0, R.maxHearts - R.hearts))}</i>`;
function hud() {
  const g = G; if (!g || g.demo) return; const t = T();
  $('hLevel').textContent = `${t.dive(g.dive)} · ${t.zoneNames[g.Z.id]}`;
  $('hTime').textContent = Math.ceil(g.time);
  $('hTime').classList.toggle('low', g.time <= 8);
  $('hCash').textContent = '₡' + money(R.cash);
  $('hHearts').innerHTML = heartsHtml();
  const db = $('dropBtn'); db.disabled = !(g.hook.st === 'retract' && g.hook.held);
}
function btn(label, act, cls = '', dis = false, data = '') { return `<button class="btn ${cls}" data-act="${act}" ${data} ${dis ? 'disabled' : ''}>${label}</button>`; }
const starsHtml = n => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(Math.max(0, 3 - n))}</i></span>`;
function renderMenu() {
  state = 'menu'; const t = T();
  $('menu').innerHTML = `<div class="logo"><h1>Space<span>Scrapper</span></h1><p class="tagline">${t.tagline}</p></div>
    <div class="col">${btn('▶ ' + t.play, 'play', 'primary big')}${btn(`${t.garage} · ${meta.parts} ⚙`, 'garage')}</div>
    ${meta.best ? `<p class="stats">${t.best}: ₡${money(meta.best)} · ${t.dive(meta.bestDive)}</p>` : ''}
    <div class="row small">${btn(`${t.sound}: ${meta.muted ? t.off : t.on}`, 'mute', 'ghost')}${btn(`${t.music}: ${meta.music ? t.on : t.off}`, 'musicT', 'ghost')}</div>`;
  show('menu');
  G = newDive(true); // animated field behind the menu
}
function renderGarage() {
  state = 'garage'; const t = T();
  $('garage').innerHTML = `<h2>${t.garage}</h2><p class="muted">${t.garageHint}</p><p class="parts">${meta.parts} ⚙ ${t.partsShort}</p>
    <div class="list">${UPS.map(u => { const lv = meta.up[u.id], max = u.cost.length, cost = u.cost[lv], [n, d] = t.ups[u.id];
      return `<div class="item"><div><b>${n} <small>${lv}/${max}</small></b><span>${d}</span><i class="pips">${'■'.repeat(lv)}${'□'.repeat(max - lv)}</i></div>${lv >= max ? `<em>${t.max}</em>` : btn(`${cost} ⚙`, 'up', 'sm', meta.parts < cost, `data-id="${u.id}"`)}</div>`; }).join('')}</div>
    <div class="row">${btn(t.back, 'menu', 'ghost')}${btn('▶ ' + t.play, 'play', 'primary')}</div>`;
  show('garage');
}
function renderResult() {
  const g = G, t = T(), stars = g.orders.filter(o => o.done).length, need = needFor(g.dive), wrecked = state === 'wrecked';
  $('result').innerHTML = `<h2>${wrecked ? t.wrecked : R.lastHit ? t.hullHit : t.diveDone}</h2>${starsHtml(stars)}
    <ul class="olist">${g.orders.map(o => `<li class="${o.done ? 'ok' : ''}"><span>${o.done ? '✓' : '✗'} ${esc(orderLabel(o))}</span><b>${o.done ? '+₡' + money(o.reward) : ''}</b></li>`).join('')}</ul>
    <p class="big-num">+₡${money(g.earned)}</p>
    <p class="hearts">${heartsHtml()}</p>${need && !wrecked ? `<p class="muted">${t.need(need)}</p>` : ''}
    <div class="col">${R.lastHit && !R.repaired && PL.canReward() ? btn('▶ ' + t.repair, 'repair', 'reward') : ''}
      ${!wrecked && R.doubled !== g.dive && PL.canReward() ? btn('▶ ' + t.double, 'double', 'reward') : ''}
      ${wrecked ? btn(t.continue + ' →', 'endRun', 'primary big') : btn(t.continue, 'toPick', 'primary big')}</div>`;
  show('result');
}
function renderPick() {
  const t = T();
  $('pick').innerHTML = `<h2>${t.pick}</h2><p class="muted">${t.pickHint}</p>
    <div class="cards">${R.offers.map(id => { const m = SS.MODS.find(x => x.id === id); return `<button class="card" data-act="pickMod" data-id="${id}"><span class="ic">${m.icon}</span><b>${m.name}</b><small>${m.desc}</small><i class="pips">${'■'.repeat(mod(id) + 1)}${'□'.repeat(m.max - mod(id) - 1)}</i></button>`; }).join('')}</div>
    <div class="col">${!R.rerolled && PL.canReward() ? btn('▶ ' + t.reroll, 'reroll', 'reward') : ''}<p class="muted">${t.next(R.dive + 1)} · ${t.zoneNames[zoneFor(R.dive + 1).id]}</p></div>`;
  show('pick');
}
function renderSummary(r) {
  const t = T();
  $('result').innerHTML = `<h2>${r.newBest ? t.newBest : t.runSummary}</h2>
    <ul class="kv"><li><span>${t.reached}</span><b>${R.dive}</b></li><li><span>${t.starsT}</span><b>★ ${R.stars}</b></li><li><span>${t.total}</span><b>₡${money(R.total)}</b></li><li><span>${t.parts}</span><b>+${r.parts} ⚙</b></li><li><span>${t.best}</span><b>₡${money(meta.best)}</b></li></ul>
    <div class="col">${btn('▶ ' + t.playAgain, 'play', 'primary big')}${btn(`${t.garage} · ${meta.parts} ⚙`, 'garage')}${btn(t.quit, 'menu', 'ghost')}</div>`;
  show('result');
}
function renderPause() {
  const t = T();
  $('pause').innerHTML = `<h2>${t.paused}</h2><div class="col">${btn('▶ ' + t.resume, 'resume', 'primary big')}${btn(`${t.sound}: ${meta.muted ? t.off : t.on}`, 'mute', 'ghost')}${btn(`${t.music}: ${meta.music ? t.on : t.off}`, 'musicT', 'ghost')}${btn(t.quit, 'quitRun', 'ghost')}</div>`;
  show('pause');
}
const toast = msg => { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); };
function setPaused(on) {
  if (state !== 'play') return;
  if (on && !paused) { paused = true; PL.gameplayStop(); renderPause(); }
  else if (!on && paused) { paused = false; show(null); last = performance.now(); PL.gameplayStart(); }
}

let busy = false;
const ACT = {
  play: () => startRun(),
  garage: () => renderGarage(),
  menu: () => renderMenu(),
  mute: () => { meta.muted = !meta.muted; saveMeta(); paused ? renderPause() : renderMenu(); },
  musicT: () => { meta.music = !meta.music; saveMeta(); paused ? renderPause() : renderMenu(); },
  up: d => { const u = UPS.find(x => x.id === d.id); if (!u) return; const lv = meta.up[u.id], cost = u.cost[lv]; if (lv >= u.cost.length || meta.parts < cost) return; meta.parts -= cost; meta.up[u.id]++; saveMeta(); SS.sfx('coin'); renderGarage(); },
  double: async () => { const g = G; if (R.doubled === g.dive) return; const ok = await PL.ad('rewarded'); if (ok) { R.doubled = g.dive; R.cash += g.earned; R.total += g.earned; g.earned *= 2; SS.sfx('big'); } else toast(T().adFail); renderResult(); },
  repair: async () => { if (R.repaired || !R.lastHit) return; const ok = await PL.ad('rewarded'); if (ok) { R.repaired = true; R.hearts++; R.lastHit = false; if (state === 'wrecked') state = 'result'; SS.sfx('big'); } else toast(T().adFail); renderResult(); },
  toPick: () => goPick(),
  pickMod: d => { if (state !== 'pick' || !R.offers.includes(d.id)) return; R.mods[d.id] = mod(d.id) + 1; SS.sfx('big'); return nextDive(); },
  reroll: async () => { if (R.rerolled) return; const ok = await PL.ad('rewarded'); if (ok) { R.rerolled = true; R.offers = offers().map(m => m.id); } else toast(T().adFail); renderPick(); },
  endRun: () => { const r = finishRun(); state = 'summary'; renderSummary(r); },
  resume: () => setPaused(false),
  quitRun: () => { paused = false; PL.gameplayStop(); finishRun(); renderMenu(); },
  pause: () => setPaused(true),
  skipTut: () => endTutorial(),
};
SS.ACT = ACT;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled || busy) return;
  const a = ACT[b.dataset.act]; if (!a) return;
  e.preventDefault(); SS.audioUnlock(); SS.sfx('click');
  busy = true; try { await a({ ...b.dataset }); } catch (err) { console.warn(err); } finally { busy = false; }
});

/* ---------- input ---------- */
// Keys use physical positions (e.code), so WASD works on AZERTY (ZQSD) too. Escape is left to the browser (it leaves fullscreen).
const KEYS_L = ['ArrowLeft', 'KeyA'], KEYS_R = ['ArrowRight', 'KeyD'], KEYS_FIRE = ['Space', 'ArrowDown', 'KeyS', 'Enter'], KEYS_DROP = ['ArrowUp', 'KeyW'];
const held = new Set();
function gamePos(e) { const c = cv(), r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * G.W, y: (e.clientY - r.top) / r.height * G.H }; }
function bindInput() {
  const c = cv();
  c.addEventListener('pointermove', e => { if (!G || G.demo || state !== 'play' || e.pointerType === 'touch') return; const p = gamePos(e); setAimAt(G, p.x, p.y); });
  c.addEventListener('pointerdown', e => {
    e.preventDefault(); SS.audioUnlock(); SS.music.update();
    if (!G || G.demo || state !== 'play' || paused) return;
    if (e.button === 2) { drop(); return; }
    const p = gamePos(e); setAimAt(G, p.x, p.y); fire();
  });
  $('dropBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); drop(); });
  window.addEventListener('keydown', e => {
    SS.audioUnlock(); SS.music.update();
    if (e.code === 'KeyD' && e.shiftKey) { e.preventDefault(); toggleDiag(); return; }
    if (state !== 'play') return;
    if (e.code === 'KeyP') { e.preventDefault(); setPaused(!paused); return; }
    if (paused) return;
    if (KEYS_L.includes(e.code) || KEYS_R.includes(e.code)) { e.preventDefault(); held.add(e.code); }
    else if (KEYS_FIRE.includes(e.code)) { e.preventDefault(); if (!e.repeat) fire(); }
    else if (KEYS_DROP.includes(e.code)) { e.preventDefault(); if (!e.repeat) drop(); }
    aimKeys();
  });
  window.addEventListener('keyup', e => { held.delete(e.code); aimKeys(); });
  // portals: never scroll the page with game keys
  window.addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }, { passive: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); SS.music.update(); });
  window.addEventListener('blur', () => { held.clear(); aimKeys(); setPaused(true); });
  window.addEventListener('resize', () => { if (G) { const L = fitCanvas(); G.ctx = L.ctx; G.s = L.s; } });
  window.addEventListener('contextmenu', e => e.preventDefault());
}
function aimKeys() { if (!G) return; G.aimV = (KEYS_R.some(k => held.has(k)) ? 1 : 0) - (KEYS_L.some(k => held.has(k)) ? 1 : 0); }
// Shift+D: SDK diagnostics (environment, init result, every call and ad error)
function toggleDiag() {
  let el = $('diag');
  if (el) { el.remove(); return; }
  el = document.createElement('pre'); el.id = 'diag';
  el.textContent = `SDK diagnostics (Shift+D to close)\nenvironment: ${PL.env}\ninit error: ${PL.initError || '-'}\nrewarded available: ${PL.canReward()}\nlast ad error: ${JSON.stringify(PL.lastAdError)}\n\n${PL.log.join('\n')}`;
  Object.assign(el.style, { position: 'fixed', inset: '10px', zIndex: 99, margin: 0, padding: '12px', overflow: 'auto', background: '#000d', color: '#9f9', font: '12px/1.4 monospace', whiteSpace: 'pre-wrap', borderRadius: '8px' });
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}
SS.toggleDiag = toggleDiag;
SS.onAdStart = () => { if (state === 'play' && !paused) setPaused(true); SS.music.update(); };
SS.onAdEnd = () => { SS.music.update(); };

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G) {
    if (((state === 'play' && !paused) || state === 'menu') && !PL.inAd && !SS.Game.manual) update(G, dt);
    draw(G);
  }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
SS.boot = async () => {
  await PL.init();
  PL.loadingStart();
  loadMeta();
  PL.listeners.push(() => SS.music.update());
  bindInput(); renderMenu();
  PL.loadingStop();
  requestAnimationFrame(t => { last = t; frame(t); });
};
})(window.SS);
