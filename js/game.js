// Space Scrapper (CrazyGames edition) — game loop, levels, shop, garage, menus.
// Core hook mechanic and creatures are adapted from the original Space Scrapper scrap hunt.
(function(SS){
const { rnd, rint, pick, clamp } = SS;
const TAU = Math.PI * 2, MIN = 20;
const $ = id => document.getElementById(id);
const Art = SS.Art, P = () => Art.P(), PL = SS.Platform;

/* =====================================================================
   META (persistent) AND TEXT
   ===================================================================== */
const UPS = [
  { id: 'claw', cost: [20, 45, 80, 130, 200] }, { id: 'winch', cost: [20, 45, 80, 130, 200] }, { id: 'magnet', cost: [25, 55, 95, 150, 220] },
  { id: 'time', cost: [30, 65, 110, 170, 250] }, { id: 'torp', cost: [40, 90, 160] }, { id: 'luck', cost: [30, 70, 130] },
];
const defMeta = () => ({ v: 1, best: 0, bestLevel: 0, parts: 0, runs: 0, up: { claw: 0, winch: 0, magnet: 0, time: 0, torp: 0, luck: 0 }, muted: false, tut: false });
const meta = SS.meta = defMeta();
const loadMeta = () => {
  const m = PL.load();
  if (m && typeof m === 'object') {
    for (const k of ['best', 'bestLevel', 'parts', 'runs']) if (Number.isFinite(m[k]) && m[k] >= 0) meta[k] = Math.floor(m[k]);
    if (m.up && typeof m.up === 'object') for (const u of UPS) if (Number.isFinite(m.up[u.id])) meta.up[u.id] = clamp(Math.floor(m.up[u.id]), 0, u.cost.length);
    meta.muted = m.muted === true; meta.tut = m.tut === true;
  }
};
const saveMeta = () => PL.save(meta);
// The CrazyGames edition is English only, whatever the browser language is
const T = () => SS.TEXT.en;
const money = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* =====================================================================
   RUN AND LEVEL RULES
   ===================================================================== */
const BOOSTS = [
  { id: 'torp', price: 45 }, { id: 'oil', price: 70 }, { id: 'strength', price: 95 }, { id: 'time', price: 80 },
  { id: 'clover', price: 60 }, { id: 'polish', price: 110 }, { id: 'radar', price: 55 },
];
const zoneFor = lv => SS.ZONES[Math.floor((lv - 1) / 3) % SS.ZONES.length];
// Field richness: expected total value of a zone's item mix (black box ≈ 180) × zone multiplier
const RICH = Object.fromEntries(SS.ZONES.map(z => [z.id, Object.entries(z.mix).reduce((a, [k, n]) => a + n * (k === 'box' ? 180 : SS.ITEMS[k].val), 0) * z.mult]));
const tourOf = lv => Math.floor((lv - 1) / 15);
// From the second tour on every zone is made as rich as the Lost Star ×1.1 per tour, so there is no drop at level 16
const richFor = lv => tourOf(lv) ? RICH.lost * Math.pow(1.1, tourOf(lv)) : RICH[zoneFor(lv).id];
const loopFor = lv => richFor(lv) / RICH[zoneFor(lv).id];
// Quota = measured casual capacity (tests/balance.js: ~680 in the belt, growing ~richness^0.85)
//       × difficulty ramp (≈33% of capacity at level 1, ~100% around level 9) × screen-area factor
SS.areaScale = 1;
SS.targetFor = lv => {
  const rich = Math.pow(richFor(lv) / RICH.belt, .85), grow = 1 + .03 * (lv - 1), ramp = Math.min(1.25, .33 + .08 * (lv - 1));
  return Math.max(150, Math.round(680 * rich * grow * ramp * SS.areaScale / 10) * 10);
};
let R = null; // current run

function pickVariant(zoneId, prev, lv) {
  if (lv === 1) return SS.VARIANTS[0];
  const L = SS.VARIANTS.filter(v => (v.w[zoneId] || 0) > 0 && v.id !== prev);
  let r = Math.random() * L.reduce((a, v) => a + v.w[zoneId], 0);
  for (const v of L) { r -= v.w[zoneId]; if (r <= 0) return v; }
  return L[0];
}

/* =====================================================================
   LEVEL ENGINE
   ===================================================================== */
let G = null; // current level
const cv = () => $('game');
function layout() {
  const st = $('stage'), cw = st.clientWidth, ch = st.clientHeight, hud = $('hud').offsetHeight || 52;
  let W, H;
  // the playfield takes the screen's aspect ratio, so there are never black bars
  if (cw / ch < .78) { W = 360; H = clamp(Math.round(360 * ch / cw), 460, 900); }
  else { H = 600; W = clamp(Math.round(600 * cw / ch), 460, 1500); }
  const s = Math.min(cw / W, ch / H);
  return { W, H, s, cw, ch, top: Math.ceil(hud / s) };
}
function fitCanvas() {
  const L = layout(), c = cv();
  c.style.width = Math.floor(L.W * L.s) + 'px'; c.style.height = Math.floor(L.H * L.s) + 'px';
  const { ctx } = Art.setup(c, L.W, L.H, 1);
  return { ...L, ctx };
}

function newLevel() {
  const lv = R.level, Z = zoneFor(lv), loop = loopFor(lv), L = fitCanvas(), b = R.boosts;
  const V = pickVariant(Z.id, R.lastVar, lv); R.lastVar = V.id;
  const OY = L.top + 82, ship = L.top + 40;
  SS.areaScale = 1 + (clamp((L.W * (L.H - 14 - OY - 70)) / (360 * 410), 1, 3.4) - 1) * .15;
  const g = {
    W: L.W, H: L.H, s: L.s, ctx: L.ctx, OX: L.W / 2, OY, shipY: ship, Z, V, loop, lv,
    target: SS.targetFor(lv), earned: 0, items: [], actors: [], warns: [], fx: SS.FX.make(), stars: Art.makeStars(Math.round(70 * L.W / 360), L.W, L.H),
    hook: { phase: 0, angle: 0, len: MIN, st: 'swing', held: null }, scene: Art.mkScene(Z.id),
    timeMax: 45 + meta.up.time * 4 + (b.time ? 10 : 0), t: 0, shake: 0, endT: -1, intro: 3.4, power: 0,
    reach: 6 + meta.up.magnet * 3.2, extendSp: (6.5 + meta.up.claw * 1.1) * (b.oil ? 1.4 : 1), winch: (1 + meta.up.winch * .2) * (b.strength ? 1.5 : 1),
    gemX: b.polish ? 2 : 1, luck: meta.up.luck + (b.clover ? 2 : 0), radar: !!b.radar, meteorT: 3, eelT: 2, droneT: 3, got: 0,
    amp: L.W > 520 ? 1.28 : 1.2,
  };
  g.time = g.timeMax;
  R.boosts = {}; // boosts are used up by this level
  spawn(g);
  if (V.id === 'drift') for (const it of g.items) if (!it.vx) it.vx = (it.y % 2 < 1 ? -1 : 1) * rnd(.22, .42) / Math.max(1, it.wt * .5);
  if (V.id === 'whale') g.actors.push({ type: 'whale', x: -150, y: rnd(g.OY + 170, g.OY + 300), vx: .55, dropped: false });
  return g;
}
const valueOf = (g, kind) => {
  const T0 = SS.ITEMS[kind]; let v = T0.val * g.Z.mult * g.loop * .5 * rnd(.9, 1.1);
  if (T0.gem) v *= g.gemX;
  return Math.round(v);
};
function rollBox(g) {
  const r = Math.random() * (1 + g.luck * .12);
  if (r < .08 - g.luck * .02) return { type: 'trap', label: '!' };
  if (r < .45) return { type: 'cash', v: Math.round(rint(40, 150) * g.Z.mult * g.loop * (1 + g.luck * .15)), label: '$' };
  if (r < .58) return { type: 'torp', label: 'TORP' };
  if (r < .72) return { type: 'time', label: '+5s' };
  if (r < .85) return { type: 'strength', label: 'PWR' };
  return { type: 'crystal', label: 'GEM' };
}
function mk(g, kind, x, y) {
  const T0 = SS.ITEMS[kind];
  const it = { kind, x, y, r: T0.r, wt: T0.wt, rot: rnd(-.5, .5), seed: Math.random() * 10 };
  if (kind === 'rock' || kind === 'boulder') it.poly = Array.from({ length: 9 }, () => rnd(.78, 1.08));
  if (kind === 'gold') it.poly = Array.from({ length: 9 }, () => rnd(.8, 1.06));
  if (kind === 'jelly') it.by = y;
  if (kind === 'mimic' && g.radar) it.tag = '!!';
  if (T0.move) it.vx = (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.2);
  if (kind === 'box') { it.box = rollBox(g); if (g.radar) it.tag = it.box.label; }
  return it;
}
function spawn(g) {
  const { W, H, OY } = g, y0 = OY + 70, y1 = H - 14, depth = y1 - y0;
  const area = clamp((W * depth) / (360 * 410), 1, 3.4);
  const mix = {};
  for (const [k, n] of Object.entries(g.Z.mix)) { const x = n * area; mix[k] = Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); }
  for (const [k, n] of Object.entries(SS.ZONE_EXTRA[g.Z.id] || {})) if (Math.random() < n) mix[k] = (mix[k] || 0) + 1;
  if (g.V.mix) g.V.mix(mix);
  if (g.lv <= 2) { mix.tank = 0; mix.mimic = 0; }
  // vertical bands (as fractions of the field depth) per item kind: valuable/heavy things sit deeper
  const band = { sat: [.3, 1], boulder: [.28, 1], crystal: [.5, 1], slime: [.38, .93], tank: [.2, .93], gold: [.38, 1], egg: [.5, 1], jelly: [.11, .84], mimic: [.18, .93], amber: [.4, 1] };
  const order = ['sat', 'boulder', 'gold', 'plate', 'part', 'box', 'mimic', 'egg', 'crystal', 'rock', 'ice', 'bolts', 'tank', 'bug', 'jelly', 'slime'];
  for (const kind of order) {
    const T0 = SS.ITEMS[kind], [b0, b1] = band[kind] || [0, 1];
    for (let i = 0; i < (mix[kind] || 0); i++) for (let k = 0; k < 150; k++) {
      const x = 16 + T0.r + Math.random() * (W - 32 - 2 * T0.r), y = y0 + (b0 + Math.random() * (b1 - b0)) * depth;
      if (y + T0.r > H - 4) continue;
      if (Math.atan2(Math.abs(x - g.OX), y - OY) > g.amp - .06) continue; // only inside the claw's swing cone
      if (g.items.every(o => Math.hypot(o.x - x, o.y - y) > o.r + T0.r + 8)) { g.items.push(mk(g, kind, x, y)); break; }
    }
  }
}
const tip = g => ({ x: g.OX + Math.sin(g.hook.angle) * g.hook.len, y: g.OY + Math.cos(g.hook.angle) * g.hook.len });
function blowTank(g, m) {
  SS.FX.burst(g.fx, m.x, m.y, ['#ffcf5a', '#ff8a3d', '#ff4b3a', '#fff3c4'], 70, 6);
  g.shake = 14; SS.sfx('boom');
  const hit = g.items.filter(o => Math.hypot(o.x - m.x, o.y - m.y) < 95);
  g.items = g.items.filter(o => !hit.includes(o));
  hit.filter(o => o.kind === 'tank').forEach(o => blowTank(g, o));
}
function grab(g, it) {
  const t = T(), C = P(), h = g.hook;
  if ((it.kind === 'jelly' && it.charged) || it.kind === 'mimic') {
    h.st = 'retract'; const loss = it.kind === 'mimic' ? 4 : 3; g.time = Math.max(.5, g.time - loss); g.shake = 8; SS.sfx('bad');
    if (it.kind === 'mimic') { g.items = g.items.filter(o => o !== it); SS.FX.burst(g.fx, it.x, it.y, [C.box, C.bad], 24, 4); SS.FX.text(g.fx, it.x, it.y - 12, t.events.mimic, C.bad); }
    else { SS.FX.burst(g.fx, it.x, it.y, [C.crystal, '#fff'], 20, 3.5); SS.FX.text(g.fx, it.x, it.y - 12, t.events.jelly, C.crystal); }
    return;
  }
  g.items = g.items.filter(o => o !== it); h.st = 'retract';
  if (it.kind === 'tank') { blowTank(g, it); SS.FX.text(g.fx, it.x, it.y - 10, t.events.boom, C.bad); const p = tip(g); h.held = mk(g, 'debris', p.x, p.y); }
  else { h.held = it; SS.sfx('grab'); }
}
function addCash(g, v, label, big) {
  const C = P(); g.earned += v; R.cash += v; R.total += v; g.got++;
  SS.FX.text(g.fx, g.OX + 80, g.OY - 18, '+' + money(v), big ? C.crystal : C.accent, label);
  SS.FX.burst(g.fx, g.OX, g.OY, [C.accent, C.star], 12, 2.5); SS.sfx(big ? 'big' : 'coin');
}
function collect(g, it) {
  const t = T(), C = P();
  if (it.kind === 'box') {
    const b = it.box;
    if (b.type === 'cash') addCash(g, b.v, t.boxes.cash);
    else if (b.type === 'torp') { R.torps++; SS.FX.text(g.fx, g.OX + 80, g.OY - 18, t.boxes.torp, C.bad); SS.sfx('coin'); }
    else if (b.type === 'time') { g.time = Math.min(g.time + 5, g.timeMax + 15); SS.FX.text(g.fx, g.OX + 80, g.OY - 18, t.boxes.time, C.good); SS.sfx('coin'); }
    else if (b.type === 'strength') { g.power = 3; SS.FX.text(g.fx, g.OX + 80, g.OY - 18, t.boxes.strength, C.good); SS.sfx('coin'); }
    else if (b.type === 'crystal') addCash(g, valueOf(g, 'crystal'), t.boxes.crystal, true);
    else { SS.FX.text(g.fx, g.OX + 80, g.OY - 18, t.boxes.trap, C.crystal2); SS.FX.burst(g.fx, g.OX, g.OY, [C.crystal, C.crystal2, C.accent], 40, 4); SS.sfx('click'); }
    return;
  }
  const v = valueOf(g, it.kind);
  addCash(g, v, t.items[it.kind], v >= 150);
}
function fire() { const g = G; if (!g || state !== 'play' || paused) return; if (g.hook.st === 'swing' && g.endT < 0 && g.intro < 3.0) { g.hook.st = 'extend'; SS.sfx('fire'); } }
function torp() {
  const g = G; if (!g || state !== 'play' || paused) return;
  const h = g.hook; if (h.st !== 'retract' || !h.held || R.torps <= 0) return;
  R.torps--; SS.FX.burst(g.fx, h.held.x, h.held.y, ['#ffcf5a', '#ff8a3d', '#fff3c4'], 40, 5); h.held = null; g.shake = 6; SS.sfx('boom'); hud();
}
function cutRope(g, why) {
  const C = P(), p = tip(g), h = g.hook;
  if (h.held && h.held.kind !== 'debris') { const it = h.held; it.x = p.x; it.y = clamp(p.y + 10, g.OY + 60, g.H - 20); g.items.push(it); }
  h.held = null; h.st = 'retract'; g.shake = 6; SS.sfx('bad'); SS.FX.text(g.fx, p.x, p.y - 10, why, C.bad);
}
function stepActors(g, dt, f) {
  const C = P(), t = T(), p = tip(g), h = g.hook, ropeOut = h.st !== 'swing' && h.len > MIN + 6, V = g.V, W = g.W, H = g.H;
  if (V.id === 'storm') {
    g.meteorT -= dt; if (g.meteorT <= 0) { g.meteorT = rnd(2.2, 3.6) / Math.min(1.8, W / 360); g.warns.push({ x: rnd(40, W - 40), t: .9 }); }
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
      if (h.st === 'extend' && Math.hypot(p.x - a.x, p.y - hy) < 18) { h.st = 'retract'; SS.FX.text(g.fx, a.x, hy - 14, t.events.eelPush, C.crystal2); SS.sfx('bad'); }
      else if (h.st === 'retract' && h.held && h.held.kind !== 'debris' && Art.segDist(a.x, hy, g.OX, g.OY, p.x, p.y) < 12) { h.held = null; SS.FX.text(g.fx, a.x, hy - 14, t.events.eelSnatch, C.bad); SS.FX.burst(g.fx, a.x, hy, [C.slime, C.crystal2], 18, 3); SS.sfx('bad'); }
      if (a.x < -90 || a.x > W + 90) a.dead = true;
    } else if (a.type === 'whale') {
      a.x += a.vx * f;
      if (!a.dropped && a.x > W * .55) { a.dropped = true; g.items.push(mk(g, 'amber', a.x - 40, clamp(a.y + 50, g.OY + 160, H - 30))); SS.FX.text(g.fx, a.x - 40, a.y + 30, t.events.amber, C.accent); }
      if (a.x > W + 200) a.dead = true;
    } else if (a.type === 'drone') {
      if (Math.hypot(p.x - a.x, p.y - a.y) < 20 && h.st !== 'swing') {
        a.dead = true; SS.FX.burst(g.fx, a.x, a.y, [C.bad, C.flame, C.metalL], 30, 4.5); SS.FX.text(g.fx, a.x, a.y - 14, t.events.droneDown, C.good); SS.sfx('boom'); g.shake = 6;
        if (a.carry) { a.carry.x = a.x; a.carry.y = clamp(a.y + 20, g.OY + 60, H - 20); g.items.push(a.carry); }
        if (h.st === 'extend') h.st = 'retract'; continue;
      }
      if (a.carry) { a.y -= 1.6 * f; if (a.y < -30) a.dead = true; continue; }
      if (!a.tgt || !g.items.includes(a.tgt)) { const vals = g.items.filter(o => ['crystal', 'part', 'sat', 'gold', 'egg', 'slime', 'amber', 'plate'].includes(o.kind)); a.tgt = vals.length ? pick(vals) : null; a.hover = 0; if (!a.tgt) { a.y -= f; if (a.y < -30) a.dead = true; continue; } }
      const dx = a.tgt.x - a.x, dy = a.tgt.y - 22 - a.y, d = Math.hypot(dx, dy);
      if (d > 3) { a.x += dx / d * Math.min(d, 1.25 * f); a.y += dy / d * Math.min(d, 1.25 * f); a.hover = 0; }
      else { a.hover += dt; if (a.hover > 2.6) { a.carry = a.tgt; g.items = g.items.filter(o => o !== a.tgt); SS.FX.text(g.fx, a.x, a.y - 14, t.events.droneSteal, C.bad); SS.sfx('bad'); } }
    }
  }
  g.actors = g.actors.filter(a => !a.dead);
}
function update(g, dt) {
  const f = dt * 60, h = g.hook;
  g.t += dt; SS.FX.step(g.fx, dt, f);
  if (g.shake > 0) g.shake = Math.max(0, g.shake - f * .8);
  g.intro = Math.max(0, g.intro - dt);
  if (g.endT >= 0) { g.endT -= dt; if (g.endT <= 0) endLevel(); return; }
  g.time -= dt;
  if (g.time <= 0) { g.time = 0; g.endT = .6; return; }
  for (const it of g.items) if (it.vx) { it.x += it.vx * f; if (it.x < 22 || it.x > g.W - 22) { it.vx *= -1; it.x = clamp(it.x, 22, g.W - 22); } }
  for (const it of g.items) {
    if (it.kind === 'jelly') { it.y = it.by + Math.sin(g.t * .9 + it.seed) * 14; it.charged = Math.sin(g.t * 1.7 + it.seed * 2) > .45; }
    else if (it.kind === 'mimic') it.teeth = Math.sin(g.t * 1.3 + it.seed) > .82;
  }
  stepActors(g, dt, f);
  if (h.st === 'swing') { h.phase += .032 * f; h.angle = g.amp * Math.sin(h.phase); }
  else if (h.st === 'extend') {
    h.len += g.extendSp * f; const p = tip(g);
    for (const it of g.items) if (Math.hypot(it.x - p.x, it.y - p.y) < it.r + g.reach) { grab(g, it); break; }
    if (h.st === 'extend' && (p.x < -5 || p.x > g.W + 5 || p.y > g.H + 5)) h.st = 'retract';
  } else {
    const sp = h.held ? (9.5 / h.held.wt) * g.winch * (g.power > 0 ? 2 : 1) : 11;
    h.len -= sp * f;
    if (h.held) { const p = tip(g); h.held.x = p.x + Math.sin(h.angle) * h.held.r * .8; h.held.y = p.y + Math.cos(h.angle) * h.held.r * .8; }
    if (h.len <= MIN) {
      h.len = MIN; const it = h.held; h.held = null; h.st = 'swing';
      if (it) { if (g.power > 0) g.power--; collect(g, it); if (!g.items.length) g.endT = .8; }
    }
  }
  hud();
}
function draw(g) {
  const c = g.ctx, C = P(), t = g.t, W = g.W, H = g.H;
  c.save();
  if (g.shake > 0) c.translate(rnd(-g.shake, g.shake) * .5, rnd(-g.shake, g.shake) * .5);
  Art.space(c, W, H, t, g.Z.id, g.stars, C);
  Art.drawScene(c, W, H, t, C, g.scene, g.V);
  for (const a of g.actors) if (a.type === 'whale') Art.drawWhale(c, a, t, C);
  for (const it of g.items) Art.item(c, it, t, C);
  const bob = Math.sin(t * 1.6) * 2, p = tip(g);
  Art.ship(c, g.OX, g.shipY + bob, 1, t, C);
  c.strokeStyle = C.rope; c.lineWidth = 2; c.beginPath(); c.moveTo(g.OX, g.shipY + 24 + bob); c.lineTo(g.OX, g.OY); c.lineTo(p.x, p.y); c.stroke();
  c.fillStyle = C.metalD; c.beginPath(); c.arc(g.OX, g.OY, 5, 0, TAU); c.fill();
  if (g.hook.held) Art.item(c, g.hook.held, t, C);
  Art.claw(c, p.x, p.y, g.hook.angle, g.hook.held ? .12 : .55, C);
  for (const a of g.actors) {
    if (a.type === 'eel') Art.drawEel(c, a, t, C); else if (a.type === 'drone') Art.drawDrone(c, a, t, C);
    else if (a.type === 'meteor') { c.fillStyle = C.flame; c.globalAlpha = .5; c.beginPath(); c.arc(a.x - a.vx * 2, a.y - a.vy * 2, 6, 0, TAU); c.fill(); c.globalAlpha = 1; c.fillStyle = C.rockD; c.beginPath(); c.arc(a.x, a.y, 5, 0, TAU); c.fill(); }
  }
  for (const w of g.warns) { c.fillStyle = C.bad; c.globalAlpha = .5 + .5 * Math.sin(t * 20); c.beginPath(); c.moveTo(w.x - 7, g.OY + 14); c.lineTo(w.x + 7, g.OY + 14); c.lineTo(w.x, g.OY + 26); c.fill(); c.globalAlpha = 1; }
  if (g.V.id === 'dark') {
    const Rr = g.radar ? 150 : 105, dg = c.createRadialGradient(p.x, p.y, Rr * .35, p.x, p.y, Rr);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(4,3,12,.93)'); c.fillStyle = dg; c.fillRect(0, g.OY + 10, W, H - g.OY - 10);
    for (const it of g.items) if (SS.ITEMS[it.kind].gem || it.kind === 'gold' || it.kind === 'crystal') { c.globalAlpha = .3 + .3 * Math.sin(t * 3 + it.seed); c.fillStyle = it.kind === 'gold' ? '#ffd35a' : C.crystal; c.fillRect(it.x - 1.5, it.y - 1.5, 3, 3); c.globalAlpha = 1; }
  }
  SS.FX.draw(g.fx, c);
  // labels (radar), floating texts, intro card
  c.font = SS.tfont(11); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const it of [...g.items, g.hook.held]) if (it && it.tag) { const w = c.measureText(it.tag).width + 10; c.fillStyle = C.ui; c.fillRect(it.x - w / 2, it.y - it.r - 22, w, 16); c.fillStyle = C.accent; c.fillText(it.tag, it.x, it.y - it.r - 14); }
  SS.FX.drawText(g.fx, c, C);
  if (g.intro > 0) {
    const tx = T(), [nm, hint] = tx.var[g.V.id], bw = Math.min(W - 40, 420), bx = (W - bw) / 2, by = clamp(g.OY + 120, 0, H - 120);
    c.globalAlpha = Math.min(1, g.intro); c.fillStyle = C.ui; c.fillRect(bx, by, bw, 74);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = C.accent; c.font = SS.tfont(20); c.fillText(nm, W / 2, by + 26);
    c.fillStyle = C.text; c.font = SS.tfont(12.5);
    const words = (g.lv === 1 && !meta.tut ? tx.tapHint : hint).split(' '), lines = [''];
    for (const wd of words) { if (c.measureText(lines[lines.length - 1] + ' ' + wd).width > bw - 30) lines.push(wd); else lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + wd; }
    lines.slice(0, 2).forEach((l, i) => c.fillText(l, W / 2, by + 48 + i * 16)); c.globalAlpha = 1;
  }
  c.restore();
}

/* =====================================================================
   FLOW: menu → level → clear/shop or game over
   ===================================================================== */
let state = 'menu', paused = false;
SS.Game = { get state() { return state; }, get paused() { return paused; }, get run() { return R; }, _dbg: () => G, _fire: () => fire(), _torp: () => torp(), _tip: g => tip(g), _value: (g, k) => valueOf(g, k),
  // tests only: step the level manually (the real loop then only draws)
  manual: false, _step: dt => { if (G && state === 'play' && !paused) update(G, dt); } };
const show = id => { document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; }); $('hud').hidden = !(id === null); document.body.dataset.state = state; };
function startRun() {
  SS.audioUnlock();
  R = { level: 1, cash: 0, total: 0, torps: 1 + meta.up.torp, boosts: {}, retried: false, lastVar: null, lastAd: 0 };
  meta.runs++; saveMeta();
  startLevel();
}
function startLevel() {
  state = 'play'; paused = false; show(null);
  G = newLevel(); hud(); PL.gameplayStart();
}
function endLevel() {
  const g = G; PL.gameplayStop();
  if (g.lv === 1 && !meta.tut) { meta.tut = true; saveMeta(); }
  if (g.earned >= g.target) {
    state = 'clear'; SS.sfx('win');
    if (g.earned >= g.target * 1.5) PL.happytime();
    renderClear();
  } else { state = 'over'; SS.sfx('lose'); renderOver(); }
}
async function maybeMidgame() {
  // midgame ad at natural breaks: from level 3 on, at most every second level
  if (R.level >= 3 && R.level - R.lastAd >= 2) { R.lastAd = R.level; await PL.ad('midgame'); }
}
function goShop() { state = 'shop'; R.offers = makeOffers(); R.freeTorpUsed = false; renderShop(); }
function makeOffers() { const pool = BOOSTS.filter(b => b.id !== 'torp').sort(() => Math.random() - .5).slice(0, 3); return [BOOSTS[0], ...pool].map(b => ({ id: b.id, price: Math.round(b.price * (1 + (R.level - 1) * .14) * rnd(.85, 1.15) / 5) * 5, bought: false })); }
async function nextLevel() { R.level++; await maybeMidgame(); startLevel(); }
function finishRun() {
  const parts = Math.floor(R.total / 40) + R.level * 2;
  const newBest = R.total > meta.best;
  meta.parts += parts; meta.best = Math.max(meta.best, R.total); meta.bestLevel = Math.max(meta.bestLevel, R.level);
  saveMeta();
  return { parts, newBest };
}

/* =====================================================================
   UI
   ===================================================================== */
function hud() {
  const g = G; if (!g) return; const t = T();
  $('hLevel').textContent = `${t.lv(g.lv)} · ${t.zoneNames[g.Z.id]}`;
  $('hTime').textContent = Math.ceil(g.time);
  $('hTime').classList.toggle('low', g.time <= 8);
  $('hCash').textContent = `${money(g.earned)} / ${money(g.target)}`;
  $('hBar').style.width = Math.min(100, g.earned / g.target * 100) + '%';
  $('hBar').classList.toggle('done', g.earned >= g.target);
  const tb = $('torpBtn'); tb.querySelector('b').textContent = R.torps; tb.disabled = R.torps <= 0 || g.hook.st !== 'retract' || !g.hook.held;
}
function btn(label, act, cls = '', dis = false, data = '') { return `<button class="btn ${cls}" data-act="${act}" ${data} ${dis ? 'disabled' : ''}>${label}</button>`; }
function renderMenu() {
  state = 'menu'; G = null; const t = T();
  $('menu').innerHTML = `<div class="logo"><canvas id="logoCv" width="300" height="150"></canvas><h1>Space<span>Scrapper</span></h1></div>
    <div class="col">${btn(t.play, 'play', 'primary big')}${btn(`${t.garage} · ${meta.parts} ⚙`, 'garage')}</div>
    <p class="stats">${meta.best ? `${t.best}: ${money(meta.best)} · ${t.lv(meta.bestLevel)}` : t.tapHint}</p>
    <div class="row small">${btn(`${t.sound}: ${meta.muted ? t.off : t.on}`, 'mute', 'ghost')}</div>`;
  show('menu'); drawLogo();
}
function drawLogo() {
  const c = $('logoCv'); if (!c) return; const { ctx } = Art.setup(c, 300, 150, 1); const C = P();
  ctx.clearRect(0, 0, 300, 150);
  Art.item(ctx, { kind: 'crystal', x: 186, y: 118, r: 13, rot: .2, seed: 1 }, 1, C);
  ctx.strokeStyle = C.rope; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 74); ctx.lineTo(176, 106); ctx.stroke();
  Art.claw(ctx, 176, 106, -.6, .45, C); Art.ship(ctx, 150, 50, 1, 1, C);
}
function renderGarage() {
  state = 'garage'; const t = T();
  $('garage').innerHTML = `<h2>${t.garage}</h2><p class="muted">${t.garageHint}</p><p class="parts">${meta.parts} ⚙ ${t.partsShort}</p>
    <div class="list">${UPS.map(u => { const lv = meta.up[u.id], max = u.cost.length, cost = u.cost[lv], [n, d] = t.ups[u.id];
      return `<div class="item"><div><b>${n} <small>${lv}/${max}</small></b><span>${d}</span><i class="pips">${'■'.repeat(lv)}${'□'.repeat(max - lv)}</i></div>${lv >= max ? `<em>${t.max}</em>` : btn(`${cost} ⚙`, 'up', 'sm', meta.parts < cost, `data-id="${u.id}"`)}</div>`; }).join('')}</div>
    <div class="row">${btn(t.back, 'menu', 'ghost')}${btn(t.play, 'play', 'primary')}</div>`;
  show('garage');
}
function renderClear() {
  const g = G, t = T();
  $('clear').innerHTML = `<h2>${t.levelClear}</h2><p class="big-num">+${money(g.earned)}</p><p class="muted">${t.target}: ${money(g.target)} · ${t.cash}: ${money(R.cash)}</p>
    <div class="col">${R.doubled === g.lv ? '' : btn('▶ ' + t.double, 'double', 'reward')}${btn(t.continue, 'toShop', 'primary big')}</div>`;
  show('clear');
}
function renderShop() {
  const t = T();
  $('shop').innerHTML = `<h2>${t.shop}</h2><p class="muted">${t.shopHint}</p><p class="parts">${t.cash}: ${money(R.cash)} · ${t.torpedo}: ${R.torps}</p>
    <div class="list">${R.offers.map((o, i) => { const [n, d] = t.boosts[o.id]; return `<div class="item"><div><b>${n}</b><span>${d}</span></div>${o.bought ? `<em>${t.owned}</em>` : btn(money(o.price), 'buy', 'sm', R.cash < o.price, `data-i="${i}"`)}</div>`; }).join('')}</div>
    <div class="col">${R.freeTorpUsed ? '' : btn('▶ ' + t.freeTorp, 'freeTorp', 'reward')}${btn(`${t.next}: ${t.lv(R.level + 1)} · ${t.target} ${money(SS.targetFor(R.level + 1))}`, 'next', 'primary big')}</div>`;
  show('shop');
}
function renderOver(res) {
  const g = G, t = T();
  $('over').innerHTML = `<h2>${t.failed}</h2><p class="muted">${t.needed}: ${money(g.target)} · ${t.earned}: ${money(g.earned)}</p>
    <div class="col">${R.retried ? '' : btn('▶ ' + t.retry, 'retry', 'reward')}${btn(t.gameOver + ' →', 'endRun', 'primary big')}</div>`;
  show('over');
}
function renderSummary(r) {
  const t = T();
  $('over').innerHTML = `<h2>${r.newBest ? t.newBest : t.runSummary}</h2>
    <ul class="kv"><li><span>${t.reached}</span><b>${R.level}</b></li><li><span>${t.total}</span><b>${money(R.total)}</b></li><li><span>${t.parts}</span><b>+${r.parts} ⚙</b></li><li><span>${t.best}</span><b>${money(meta.best)}</b></li></ul>
    <div class="col">${btn(t.playAgain, 'play', 'primary big')}${btn(`${t.garage} · ${meta.parts} ⚙`, 'garage')}${btn(t.quit, 'menu', 'ghost')}</div>`;
  show('over');
}
function renderPause() {
  const t = T();
  $('pause').innerHTML = `<h2>${t.paused}</h2><div class="col">${btn(t.resume, 'resume', 'primary big')}${btn(`${t.sound}: ${meta.muted ? t.off : t.on}`, 'mute', 'ghost')}${btn(t.quit, 'quitRun', 'ghost')}</div>`;
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
  mute: () => { meta.muted = !meta.muted; saveMeta(); state === 'play' ? renderPause() : renderMenu(); },
  up: d => { const u = UPS.find(x => x.id === d.id); if (!u) return; const lv = meta.up[u.id], cost = u.cost[lv]; if (lv >= u.cost.length || meta.parts < cost) return; meta.parts -= cost; meta.up[u.id]++; saveMeta(); SS.sfx('coin'); renderGarage(); },
  double: async () => { const g = G; if (R.doubled === g.lv) return; const ok = await PL.ad('rewarded'); if (ok) { R.doubled = g.lv; R.cash += g.earned; R.total += g.earned; g.earned *= 2; SS.sfx('big'); } else toast(T().adFail); renderClear(); },
  toShop: () => goShop(),
  buy: d => { const o = R.offers[+d.i]; if (!o || o.bought || R.cash < o.price) return; R.cash -= o.price; o.bought = true; if (o.id === 'torp') R.torps++; else R.boosts[o.id] = true; SS.sfx('coin'); renderShop(); },
  freeTorp: async () => { if (R.freeTorpUsed) return; const ok = await PL.ad('rewarded'); if (ok) { R.freeTorpUsed = true; R.torps++; SS.sfx('coin'); } else toast(T().adFail); renderShop(); },
  next: () => nextLevel(),
  retry: async () => { if (R.retried) return; const ok = await PL.ad('rewarded'); if (ok) { R.retried = true; R.cash -= Math.min(R.cash, G.earned); R.total -= G.earned; startLevel(); } else { toast(T().adFail); renderOver(); } },
  endRun: () => { const r = finishRun(); state = 'summary'; renderSummary(r); },
  resume: () => setPaused(false),
  quitRun: () => { paused = false; PL.gameplayStop(); finishRun(); renderMenu(); },
  pause: () => setPaused(true),
};
SS.ACT = ACT;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled || busy) return;
  const a = ACT[b.dataset.act]; if (!a) return;
  e.preventDefault(); SS.audioUnlock(); SS.sfx('click');
  busy = true; try { await a({ ...b.dataset }); } catch (err) { console.warn(err); } finally { busy = false; }
});

/* ---------- input ---------- */
function bindInput() {
  const c = cv();
  c.addEventListener('pointerdown', e => { e.preventDefault(); SS.audioUnlock(); fire(); });
  $('torpBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); torp(); });
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (state === 'play') {
      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); if (!paused) fire(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyT' || e.code === 'KeyW') { e.preventDefault(); torp(); }
      else if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); setPaused(!paused); }
    }
  });
  // portals: never scroll the page with game keys
  window.addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }, { passive: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('blur', () => setPaused(true));
  window.addEventListener('resize', () => { if (G) { const L = fitCanvas(); G.ctx = L.ctx; G.s = L.s; } else if (state === 'menu') drawLogo(); });
  window.addEventListener('contextmenu', e => e.preventDefault());
}
SS.onAdStart = () => { if (state === 'play' && !paused) setPaused(true); };
SS.onAdEnd = () => {};

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G && (state === 'play' || state === 'clear' || state === 'over' || state === 'shop')) {
    if (state === 'play' && !paused && !PL.inAd && !SS.Game.manual) update(G, dt);
    draw(G);
  }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
SS.boot = async () => {
  PL.loadingStart && PL.loadingStart();
  await PL.init();
  PL.loadingStart();
  loadMeta();
  PL.listeners.push(() => {});
  bindInput(); renderMenu();
  PL.loadingStop();
  requestAnimationFrame(t => { last = t; frame(t); });
};
})(window.SS);
