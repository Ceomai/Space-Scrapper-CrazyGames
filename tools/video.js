// Önizleme videoları: denge botu oyunu oynar, her kare tek tek çekilir, ffmpeg ile MP4 yapılır.
// node tools/video.js  →  promo/preview-landscape.mp4, promo/preview-portrait.mp4
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), URL = 'file://' + path.join(ROOT, 'index.html');
const src = fs.readFileSync(path.join(ROOT, 'tests/balance.js'), 'utf8');
const BOT = src.slice(src.indexOf('const BOT = () => {') + 12, src.indexOf('\n};\n', src.indexOf('const BOT = () => {')) + 2);
const FPS = 30;
const SCENES = [{ lv: 1, v: 'calm', sec: 4.5 }, { lv: 8, v: 'whale', sec: 4.5 }, { lv: 11, v: 'raiders', sec: 4 }];
(async () => {
  const b = await chromium.launch();
  for (const [w, h, name, title] of [[1920, 1080, 'preview-landscape', 150], [1080, 1920, 'preview-portrait', 120]]) {
    const dir = path.join(ROOT, 'promo', 'frames-' + name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.route(/crazygames/, r => r.abort());
    await p.addInitScript(`(${BOT})()`);
    await p.goto(URL); await p.waitForTimeout(300);
    let n = 0; const shot = async () => { await p.evaluate(() => SS.Game._draw()); await p.screenshot({ path: path.join(dir, `f${String(n++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 }); };
    await p.evaluate(() => { window.__skill = 1; SS.Game.manual = true; Math.random = SS.mulberry(11); SS.ACT.play(); });
    for (const sc of SCENES) {
      await p.evaluate(async sc => {
        for (let k = 0; k < 60; k++) { SS.Game.run.level = sc.lv - 1; SS.Game.run.lastAd = 99; await SS.ACT.next(); if (SS.Game._dbg().V.id === sc.v) break; }
        const g = SS.Game._dbg(); g.intro = 1.6; SS.Game.run.cash = 0;
        for (let i = 0; i < 20; i++) { window.__bot(); SS.Game._step(1 / 30); }
      }, sc);
      for (let f = 0; f < sc.sec * FPS; f++) { await p.evaluate(() => { window.__bot(); SS.Game._step(1 / 30); }); await shot(); }
    }
    // kapanış: logo ve çağrı
    await p.evaluate(size => {
      const t = document.createElement('div');
      t.innerHTML = `<h1 style="font-size:${size}px;text-shadow:0 6px 0 #0008,0 0 40px #ff4f9a88">Space<span>Scrapper</span></h1><p style="font:700 ${Math.round(size / 3)}px var(--font);color:#ffec27;margin:18px 0 0;text-shadow:0 3px 0 #0008">Swing. Grab. Beat the quota!</p>`;
      Object.assign(t.style, { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c0a1d99', textAlign: 'center', opacity: 0, transition: 'none' });
      t.id = 'endcard'; document.body.appendChild(t); document.getElementById('hud').hidden = true;
    }, title);
    for (let f = 0; f < 2 * FPS; f++) { await p.evaluate(f => { document.getElementById('endcard').style.opacity = Math.min(1, f / 12); window.__bot(); SS.Game._step(1 / 30); }, f); await shot(); }
    await p.close();
    const out = path.join(ROOT, 'promo', name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', out]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(name, n, 'kare', Math.round(fs.statSync(out).size / 1024), 'KB');
  }
  await b.close();
})();
