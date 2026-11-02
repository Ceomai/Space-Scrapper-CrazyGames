// Mağaza/portal kapak görselleri: oyunun kendi sahnesinden üretilir. node tools/promo.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const b = await chromium.launch();
  for (const [w, h, name, size] of [[1920, 1080, 'cover-1920x1080', 150], [800, 1200, 'cover-800x1200', 92], [800, 800, 'cover-800x800', 84]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); await p.route(/crazygames/, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(300);
    await p.evaluate(size => {
      Math.random = SS.mulberry(7);
      SS.ACT.play(); const g = SS.Game._dbg(); g.intro = 0; SS.Game.manual = true;
      g.V = SS.VARIANTS.find(v => v.id === 'calm');
      g.hook.angle = .45; g.hook.len = Math.min(g.H - g.OY - 60, 260); g.hook.st = 'retract';
      const p = SS.Game._tip(g); g.hook.held = { kind: 'crystal', x: p.x + 8, y: p.y + 12, r: 11, wt: 1, rot: .2, seed: 2 };
      document.getElementById('hud').hidden = true;
      const t = document.createElement('div');
      t.innerHTML = `<h1 style="font-size:${size}px;text-shadow:0 6px 0 #0008,0 0 40px #ff4f9a88">Space<span>Scrapper</span></h1>`;
      Object.assign(t.style, { position: 'fixed', left: 0, right: 0, bottom: '6%', zIndex: 50, textAlign: 'center', pointerEvents: 'none' });
      document.body.appendChild(t);
    }, size);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(__dirname, '../promo', name + '.png') });
    await p.close();
  }
  await b.close();
})();
