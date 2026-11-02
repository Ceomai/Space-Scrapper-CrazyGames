// Denge botu: hızlandırılmış zamanda kusursuza yakın nişan alan bot; garaj seviyelerine göre ulaşılan seviyeyi ölçer.
// Kullanım: node tests/balance.js [tur sayısı=6]
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const RUNS = +process.argv[2] || 6, SKILL = +(process.argv[3] || 1);
const BOT = () => {
  const SKIP = new Set(['tank', 'mimic', 'debris']);
  window.__levels = [];
  window.__bot = () => {
    const st = SS.Game.state, g = SS.Game._dbg();
    if (st !== 'play' || !g || SS.Game.paused) return;
    const skill = window.__skill;
    const h = g.hook;
    if (h.st === 'retract' && h.held && ['rock', 'boulder', 'debris'].includes(h.held.kind) && SS.Game.run.torps > 0 && h.len > 120) SS.Game._torp();
    if (h.st !== 'swing' || g.intro >= 3.0 || g.endT >= 0) return;
    const firstHit = ang => { for (let len = 20; len < 1400; len += 5) { const x = g.OX + Math.sin(ang) * len, y = g.OY + Math.cos(ang) * len; if (x < -5 || x > g.W + 5 || y > g.H + 5) return null; for (const it of g.items) if (Math.hypot(it.x - x, it.y - y) < it.r + g.reach) return { it, len }; } return null; };
    const score = hit => { if (!hit) return -1; const it = hit.it; if (SKIP.has(it.kind) || (it.kind === 'jelly' && it.charged) || (g.__miss && g.__miss.get(it) >= 3)) return -1;
      const v = it.kind === 'box' ? 90 * g.Z.mult * g.loop : SS.Game._value(g, it.kind); const tf = hit.len / g.extendSp + hit.len / ((9.5 / it.wt) * g.winch) + 6; return v / tf; };
    if (skill < 1 && g.t - (g.__last || 0) < .9) return;              // insan: düşünme süresi
    if (!g.__plan || g.__plan.t < g.t - 1.2) {
      const cand = []; for (let a = -g.amp + .02; a <= g.amp - .02; a += .02) { const s = score(firstHit(a)); if (s > 0) cand.push({ a, s }); }
      cand.sort((x, y) => y.s - x.s);
      const pickFrom = skill < 1 ? cand.filter(c => c.s >= cand[0].s * .35) : cand.slice(0, 1);
      const c = pickFrom.length ? pickFrom[Math.floor(Math.random() * pickFrom.length)] : null;
      const hit = c && firstHit(c.a);
      g.__plan = c ? { a: c.a + (skill < 1 ? (Math.random() - .5) * .09 : 0), s: c.s, t: g.t, it: hit && hit.it, tol: hit ? Math.min(.025, (hit.it.r + g.reach) * .5 / hit.len) : .025 } : { a: 0, s: -1, t: g.t };
    }
    if (g.__plan.s > 0 && Math.abs(h.angle - g.__plan.a) < g.__plan.tol) { g.__miss = g.__miss || new Map(); if (g.__plan.it) g.__miss.set(g.__plan.it, (g.__miss.get(g.__plan.it) || 0) + 1); SS.Game._fire(); g.__plan = null; g.__last = g.t; }
  };
};
(async () => {
  const b = await chromium.launch(); const res = {};
  const configs = [['garaj 0', 0], ['garaj orta', 2], ['garaj tam', 5]];
  for (const [name, upLv] of configs) for (const [vw, vh, ori] of [[390, 844, 'dikey'], [1000, 562, 'yatay']]) {
    const key = `${name} · ${ori}`; res[key] = [];
    for (let r = 0; r < RUNS; r++) {
      const ctx = await b.newContext({ viewport: { width: vw, height: vh } }); const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.route(/crazygames\.com/, x => x.abort());
      await p.addInitScript(BOT); if (process.env.CAP) await p.addInitScript(() => { window.__cap = 1; });
      await p.goto(URL); await p.waitForTimeout(200);
      const out = await p.evaluate(async ([upLv, skill]) => {
        window.__skill = skill; SS.Game.manual = true; if (window.__cap) SS.targetFor = () => 1;
        for (const k in SS.meta.up) SS.meta.up[k] = Math.min(upLv, k === 'torp' || k === 'luck' ? 3 : 5);
        SS.ACT.play(); const lv = [];
        for (let guard = 0; guard < 400; guard++) {
          const st = SS.Game.state, R = SS.Game.run, g = SS.Game._dbg();
          if (st === 'play') { for (let f = 0; f < 600 && SS.Game.state === 'play'; f++) { window.__bot(); SS.Game._step(1 / 60); } continue; }
          if (st === 'clear') { lv.push(window.__cap ? g.earned : +(g.earned / g.target).toFixed(2)); SS.ACT.toShop(); }
          else if (st === 'shop') { R.offers.forEach((o, i) => { if (!o.bought && R.cash >= o.price && ['time', 'strength', 'polish', 'oil', 'torp'].includes(o.id)) SS.ACT.buy({ i }); }); await SS.ACT.next(); }
          else if (st === 'over') { lv.push(+(g.earned / g.target).toFixed(2)); return { level: R.level, total: R.total, ratios: lv }; }
          if (R && R.level > (window.__cap ? 20 : 30)) return { level: R.level, total: R.total, ratios: lv, capped: 1 };
        }
        return { level: SS.Game.run.level, timeout: 1, ratios: lv };
      }, [upLv, SKILL]);
      out.errs = errs.slice(0, 2); res[key].push(out); await ctx.close();
    }
    const L = res[key].map(x => x.level); console.log(key.padEnd(22), 'ulaşılan seviye', L.join(','), '· ort', (L.reduce((a, c) => a + c, 0) / L.length).toFixed(1), res[key].some(x => x.errs.length) ? 'HATA ' + JSON.stringify(res[key].find(x => x.errs.length).errs) : '');
  }
  require('fs').writeFileSync(path.join(__dirname, 'balance-out.json'), JSON.stringify(res, null, 1));
  await b.close();
})();
