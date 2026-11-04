// Denge botu: nişan alıp atan bot bütün koşular oynar; dalış başına tamamlanan sipariş (yıldız) ve koşu uzunluğu ölçülür.
// İki beceri: "iyi" (hedefe tam nişan, siparişe öncelik) ve "insan" (nişan hatası, gecikme, bazen önceliği unutur).
// Kullanım: node tests/balance.js [koşu sayısı]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = process.env.GAME_URL || 'file://' + path.resolve(__dirname, '../index.html');
const RUNS = +(process.argv[2] || 4);
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [w, h] of [[1280, 720], [390, 844]]) for (const skill of ['good', 'human']) for (const garage of [0, 3]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(URL); await p.waitForTimeout(500);
    const res = await p.evaluate(async ([skill, garage, RUNS]) => {
      const meta = SS.meta; meta.tut = true; for (const k in meta.up) meta.up[k] = Math.min(garage, k === 'hull' ? 1 : 3);
      SS.Game.manual = true; const runs = [];
      for (let r = 0; r < RUNS; r++) {
        SS.ACT.play(); const per = []; let delay = 0;
        for (let guard = 0; guard < 160 && SS.Game.state !== 'summary'; guard++) {
          if (SS.Game.state === 'play') {
            const g = SS.Game._dbg();
            for (let i = 0; i < 60 * 80 && SS.Game.state === 'play'; i++) {
              if (g.hook.st === 'idle' && g.intro < 2 && (delay -= 1 / 60) <= 0) {
                let best = null, bs = -1;
                for (let a = -g.amp; a <= g.amp; a += .015) {
                  const hit = SS.Game._aimHit(g, a); if (!hit.it) continue; const it = hit.it, k = it.kind;
                  if (['tank', 'mimic'].includes(k) || (k === 'jelly' && it.charged)) continue;
                  const fits = g.orders.some(o => !o.done && (o.type === 'kind' ? o.kind === k : SS.catOf(k) === o.cat));
                  const sc = (SS.Game._value(g, k) + 20) * (fits && (skill === 'good' || Math.random() < .7) ? 4 : 1) / (hit.len * SS.ITEMS[k].wt);
                  if (sc > bs) { bs = sc; best = a; }
                }
                if (best != null) { g.aim = best + (skill === 'human' ? (Math.random() - .5) * .09 : 0); SS.Game._fire(); delay = skill === 'human' ? .35 + Math.random() * .5 : .05; }
              }
              SS.Game._step(1 / 60);
            }
          } else if (SS.Game.state === 'result' || SS.Game.state === 'wrecked') {
            const g = SS.Game._dbg(); per.push(g.orders.filter(o => o.done).length);
            await SS.ACT[SS.Game.state === 'wrecked' ? 'endRun' : 'toPick']();
          } else if (SS.Game.state === 'pick') { const c = document.querySelector('.card'); await SS.ACT.pickMod({ id: c.dataset.id }); }
          else break;
        }
        runs.push({ dives: SS.Game.run.dive, stars: per.join(''), cash: SS.Game.run.total });
        SS.ACT.menu();
      }
      return runs;
    }, [skill, garage, RUNS]);
    const avg = k => Math.round(res.reduce((a, r) => a + r[k], 0) / res.length * 10) / 10;
    out[`${w}x${h} ${skill} garaj${garage}`] = { ortDalış: avg('dives'), ortNakit: avg('cash'), yıldızlar: res.map(r => r.stars) };
    if (skill === 'human' && (avg('dives') < 5 || avg('dives') > 60)) console.log(`HATA: insan profili ${w}x${h} garaj${garage} ortalama ${avg('dives')} dalış (beklenen 5–60)`);
    console.log(`${w}x${h} ${skill} garaj${garage}: ort. dalış ${avg('dives')}, nakit ${avg('cash')} | ${res.map(r => r.stars).join(' / ')}`);
    await p.close();
  }
  fs.writeFileSync(path.join(__dirname, 'balance-out.json'), JSON.stringify(out, null, 1));
  await b.close();
})();
