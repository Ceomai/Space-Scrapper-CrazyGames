// Akış testi: CrazyGames SDK v3 taklidiyle bütün ekranlar, reklam noktaları, oynanış olayları, kayıt,
// SDK'sız çalışma, iki dil, yeniden yükleme ve ekran görüntüleri.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const MOCK = () => {
  window.__calls = []; window.__store = window.__store || JSON.parse(sessionStorage.getItem('mockStore') || '{}');
  const log = n => window.__calls.push(n);
  window.CrazyGames = { SDK: {
    environment: 'crazygames',
    init: async () => log('init'),
    game: { loadingStart: () => log('loadingStart'), loadingStop: () => log('loadingStop'), gameplayStart: () => log('gameplayStart'), gameplayStop: () => log('gameplayStop'), happytime: () => log('happytime'),
      settings: { muteAudio: false }, addSettingsChangeListener: f => { window.__settings = f; } },
    ad: { requestAd: (type, cb) => { log('ad:' + type); cb.adStarted && cb.adStarted(); setTimeout(() => { if (window.__adFail) cb.adError && cb.adError('no fill'); else cb.adFinished && cb.adFinished(); }, 30); } },
    data: { getItem: k => (k in window.__store ? window.__store[k] : null), setItem: (k, v) => { window.__store[k] = String(v); sessionStorage.setItem('mockStore', JSON.stringify(window.__store)); log('data:set'); }, removeItem: k => { delete window.__store[k]; } },
  } };
};
let failed = 0; const report = [];
const SS_TEXT_CHECK = keys => Object.fromEntries(keys.map(k => [k, 1]));
const check = (ok, name, info = '') => { if (!ok) failed++; report.push(`${ok ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
const endLevel = (p, win) => p.evaluate(win => { const g = SS.Game._dbg(); if (win) { g.earned = g.target; SS.Game.run.cash += g.target; SS.Game.run.total += g.target; } g.time = .01; SS.Game.manual = true; for (let i = 0; i < 80 && SS.Game.state === 'play'; i++) SS.Game._step(1 / 30); SS.Game.manual = false; return SS.Game.state; }, win);

(async () => {
  const b = await chromium.launch();
  /* 1. SDK ile tam akış */
  {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 562 } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); const reqs = [];
    p.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:')) reqs.push(u); });
    await p.route(/crazygames\.com/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* sdk mock is injected */' }));
    await p.addInitScript(MOCK);
    await p.goto(URL); await p.waitForTimeout(400);
    let calls = await p.evaluate(() => window.__calls.slice());
    check(calls[0] === 'init' && calls.includes('loadingStart') && calls.includes('loadingStop'), 'SDK başlatma ve yükleme olayları', calls.join(','));
    await p.screenshot({ path: path.join(OUT, 'menu-landscape.png') });
    await p.click('.screen:not([hidden]) [data-act=play]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => window.__calls.at(-1) === 'gameplayStart'), 'Seviye başında gameplayStart');
    await p.click('#hud [data-act=pause]'); await p.waitForTimeout(100);
    check(await p.evaluate(() => SS.Game.paused && window.__calls.at(-1) === 'gameplayStop'), 'Duraklatmada gameplayStop');
    await p.screenshot({ path: path.join(OUT, 'pause.png') });
    await p.click('.screen:not([hidden]) [data-act=resume]'); await p.waitForTimeout(100);
    check(await p.evaluate(() => !SS.Game.paused && window.__calls.at(-1) === 'gameplayStart'), 'Devamda gameplayStart');
    await p.waitForTimeout(2500); await p.screenshot({ path: path.join(OUT, 'play-landscape.png') });
    check(await endLevel(p, true) === 'clear', 'Kota tutunca seviye tamam ekranı');
    await p.screenshot({ path: path.join(OUT, 'clear.png') });
    const before = await p.evaluate(() => SS.Game.run.cash);
    await p.click('.screen:not([hidden]) [data-act=double]'); await p.waitForTimeout(200);
    const after = await p.evaluate(() => ({ cash: SS.Game.run.cash, last: window.__calls.filter(c => c.startsWith('ad')).at(-1) }));
    check(after.cash > before && after.last === 'ad:rewarded', 'Ödüllü reklam: seviye parası ikiye katlandı', `${before} → ${after.cash}`);
    check(!(await p.$('.screen:not([hidden]) [data-act=double]')), 'İkiye katlama aynı seviyede bir kez');
    await p.click('.screen:not([hidden]) [data-act=toShop]'); await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(OUT, 'shop.png') });
    const t0 = await p.evaluate(() => SS.Game.run.torps);
    await p.click('.screen:not([hidden]) [data-act=freeTorp]'); await p.waitForTimeout(200);
    check(await p.evaluate(t0 => SS.Game.run.torps === t0 + 1, t0), 'Ödüllü reklam: +1 torpido');
    const buyable = await p.$('.screen:not([hidden]) [data-act=buy]:not([disabled])');
    if (buyable) { await buyable.click(); await p.waitForTimeout(80); }
    check(await p.evaluate(() => SS.Game.run.offers.some(o => o.bought)), 'Dükkândan alışveriş');
    // seviye 2 → 3 geçişinde seviye arası reklam
    await p.click('.screen:not([hidden]) [data-act=next]'); await p.waitForTimeout(250);
    let mid = await p.evaluate(() => window.__calls.filter(c => c === 'ad:midgame').length);
    check(mid === 0, 'Seviye 2\'de seviye arası reklam yok');
    await endLevel(p, true); await p.click('.screen:not([hidden]) [data-act=toShop]'); await p.click('.screen:not([hidden]) [data-act=next]'); await p.waitForTimeout(300);
    mid = await p.evaluate(() => ({ n: window.__calls.filter(c => c === 'ad:midgame').length, lv: SS.Game.run.level, st: SS.Game.state }));
    check(mid.n === 1 && mid.lv === 3 && mid.st === 'play', 'Seviye 3 başında bir seviye arası reklam', JSON.stringify(mid));
    await endLevel(p, true); await p.click('.screen:not([hidden]) [data-act=toShop]'); await p.click('.screen:not([hidden]) [data-act=next]'); await p.waitForTimeout(300);
    mid = await p.evaluate(() => window.__calls.filter(c => c === 'ad:midgame').length);
    check(mid === 1, 'Seviye 4\'te yeni reklam yok (en fazla iki seviyede bir)');
    // başarısızlık → tekrar dene (ödüllü) → başarısızlık → özet
    check(await endLevel(p, false) === 'over', 'Kota tutmayınca başarısızlık ekranı');
    await p.screenshot({ path: path.join(OUT, 'failed.png') });
    await p.click('.screen:not([hidden]) [data-act=retry]'); await p.waitForTimeout(250);
    check(await p.evaluate(() => SS.Game.state === 'play' && SS.Game.run.retried && SS.Game.run.level === 4), 'Ödüllü reklamla aynı seviyeyi tekrar deneme');
    await endLevel(p, false);
    check(!(await p.$('.screen:not([hidden]) [data-act=retry]')), 'Tekrar deneme turda bir kez');
    await p.click('.screen:not([hidden]) [data-act=endRun]'); await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(OUT, 'summary.png') });
    const meta = await p.evaluate(() => ({ parts: SS.meta.parts, best: SS.meta.best, saved: window.__calls.includes('data:set') }));
    check(meta.parts > 0 && meta.best > 0 && meta.saved, 'Tur sonu: parça, rekor ve SDK veri modülüne kayıt', JSON.stringify(meta));
    await p.click('.screen:not([hidden]) [data-act=garage]'); await p.waitForTimeout(80);
    const up = await p.$('.screen:not([hidden]) [data-act=up]:not([disabled])'); if (up) { await up.click(); await p.waitForTimeout(80); }
    await p.screenshot({ path: path.join(OUT, 'garage.png') });
    const upSum = await p.evaluate(() => Object.values(SS.meta.up).reduce((a, b) => a + b, 0));
    check(upSum >= 1, 'Garajda kalıcı yükseltme', `toplam seviye ${upSum}`);
    // yeniden yükleme: kayıt SDK veri modülünden geri gelmeli
    await p.reload(); await p.waitForTimeout(400);
    const back = await p.evaluate(() => ({ parts: SS.meta.parts, up: Object.values(SS.meta.up).reduce((a, b) => a + b, 0) }));
    check(back.up === upSum, 'Yeniden açılışta garaj ve parçalar korunuyor', JSON.stringify(back));
    // ses ayarı SDK'dan
    await p.evaluate(() => window.__settings && window.__settings({ muteAudio: true }));
    check(await p.evaluate(() => SS.Platform.muted === true), 'SDK sessiz ayarı uygulanıyor');
    // reklam hatası: oyun takılmaz, uyarı gösterir
    await p.click('.screen:not([hidden]) [data-act=play]'); await endLevel(p, true);
    await p.evaluate(() => { window.__adFail = true; });
    await p.click('.screen:not([hidden]) [data-act=double]'); await p.waitForTimeout(200);
    check(await p.evaluate(() => SS.Game.state === 'clear' && !document.getElementById('toast').hidden), 'Reklam gelmezse oyun sürüyor ve uyarı çıkıyor');
    const ext = reqs.filter(u => !/crazygames\.com/.test(u));
    check(!ext.length, 'Dış istek yok (yalnızca CrazyGames SDK)', ext.slice(0, 3).join(' '));
    check(!(await p.$('a[href^="http"]')), 'Dış bağlantı yok');
    check(!errs.length, 'Sayfa hatası yok', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  /* 2. SDK yokken (yerel önizleme, reklam engelleyici) ve yabancı dilde tarayıcı: oyun her zaman İngilizce */
  for (const locale of ['tr-TR', 'de-DE']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/crazygames\.com/, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(400);
    const ui = await p.evaluate(() => ({ play: document.querySelector('#menu [data-act=play]').textContent, lang: document.documentElement.lang, tr: document.documentElement.getAttribute('translate'), langBtn: !!document.querySelector('[data-act=lang]') }));
    check(ui.play === 'Play' && ui.lang === 'en' && ui.tr === 'no' && !ui.langBtn, `${locale} tarayıcıda oyun İngilizce, otomatik çeviri kapalı, dil düğmesi yok`, JSON.stringify(ui));
    if (locale === 'tr-TR') {
      await p.screenshot({ path: path.join(OUT, 'menu-portrait.png') });
      await p.click('.screen:not([hidden]) [data-act=play]'); await p.waitForTimeout(2600);
      await p.screenshot({ path: path.join(OUT, 'play-portrait.png') });
      await endLevel(p, true); await p.click('.screen:not([hidden]) [data-act=double]'); await p.waitForTimeout(150);
      check(await p.evaluate(() => SS.Game.state === 'clear'), 'SDK yokken reklam düğmesi oyunu kilitlemiyor');
      await p.click('.screen:not([hidden]) [data-act=toShop]'); await p.click('.screen:not([hidden]) [data-act=next]'); await p.waitForTimeout(200);
      check(await p.evaluate(() => SS.Game.state === 'play' && SS.Game.run.level === 2), 'SDK yokken seviye geçişi');
    }
    check(!errs.length, `${locale}: sayfa hatası yok`, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  /* 2b. Dil denetimi: bütün ekranlar, 10 saha koşulu, bütün kutu ve olay mesajları, tuvale çizilen her yazı */
  {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 562 }, locale: 'tr-TR' }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/crazygames\.com/, r => r.abort());
    await p.addInitScript(() => { window.__canvasText = new Set(); const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__canvasText.add(String(t)); return f.call(this, t, ...a); }; });
    await p.goto(URL); await p.waitForTimeout(300);
    const texts = new Set(); const grab = async () => (await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null && e.children.length === 0).map(e => e.textContent.trim()).filter(Boolean))).forEach(t => texts.add(t));
    await grab(); await p.evaluate(() => SS.ACT.garage()); await grab();
    // her saha koşulunu bir seviyede oynat: yazılar tuvale çizilsin, kutu ve olaylar tetiklensin
    const variants = await p.evaluate(() => SS.VARIANTS.map(v => v.id));
    await p.evaluate(() => SS.ACT.play());
    for (const vid of variants) {
      await p.evaluate(vid => {
        const g = SS.Game._dbg(); g.V = SS.VARIANTS.find(v => v.id === vid); g.intro = 3.3; SS.Game.manual = true;
        for (let i = 0; i < 40; i++) SS.Game._step(1 / 30);
      }, vid);
      await p.waitForTimeout(60); await grab();
    }
    await p.evaluate(() => {
      // bütün kutu sonuçları ve olay mesajları
      const g = SS.Game._dbg(), t = SS.TEXT.en;
      for (const k of Object.keys(t.boxes)) SS.FX.text(g.fx, 10, 10, t.boxes[k]); for (const k of Object.keys(t.events)) SS.FX.text(g.fx, 10, 10, t.events[k]);
      for (const k of Object.keys(t.items)) SS.FX.text(g.fx, 10, 10, '+1', null, t.items[k]);
      SS.Game.manual = true; SS.Game._step(1 / 60);
    });
    await p.waitForTimeout(80); await grab();
    await endLevel(p, true); await grab(); await p.click('.screen:not([hidden]) [data-act=toShop]'); await grab();
    await p.evaluate(() => { SS.Game.run.offers = ['torp', 'oil', 'strength', 'time', 'clover', 'polish', 'radar'].map(id => ({ id, price: 1, bought: false })); SS.ACT.toShop(); SS.Game.run.offers = ['torp', 'oil', 'strength', 'time', 'clover', 'polish', 'radar'].map(id => ({ id, price: 1, bought: false })); });
    await p.evaluate(() => { document.getElementById('shop').innerHTML = ''; }); await p.evaluate(() => SS.ACT.next()); await p.waitForTimeout(100);
    await p.evaluate(() => SS.ACT.pause()); await grab(); await p.evaluate(() => SS.ACT.resume());
    await endLevel(p, false); await grab(); await p.click('.screen:not([hidden]) [data-act=endRun]'); await grab();
    const all = [...texts, ...await p.evaluate(() => [...window.__canvasText]), ...await p.evaluate(() => JSON.stringify(SS.TEXT).match(/"([^"\\]|\\.)*"/g).map(s => JSON.parse(s)))];
    const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/, TR_WORDS = /\b(ve|bir|için|seviye|hurda|kanca|torpido|oyna|garaj|devam|reklam|süre|para|parça|bölge|kota)\b/i;
    const bad = [...new Set(all)].filter(s => TR_CHARS.test(s) || TR_WORDS.test(s));
    check(!bad.length && all.length > 150, `Bütün metinler İngilizce (${new Set(all).size} farklı metin tarandı: ekranlar, 10 saha koşulu, kutular, olaylar, eşyalar, dükkân, garaj)`, bad.slice(0, 6).join(' | '));
    check(!('tr' in SS_TEXT_CHECK(await p.evaluate(() => Object.keys(SS.TEXT)))), 'Oyunda yalnızca İngilizce metin seti var');
    check(!errs.length, 'Dil denetiminde sayfa hatası yok', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  /* 3. Ekran boyutları: taşma ve dokunma alanı */
  for (const [w, h] of [[320, 568], [360, 740], [414, 896], [768, 1024], [1280, 720], [1920, 1080], [844, 390]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/crazygames\.com/, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(300);
    const bad = [];
    for (const step of ['menu', 'play', 'clear', 'shop', 'garage']) {
      if (step === 'play') { await p.click('.screen:not([hidden]) [data-act=play]'); await p.waitForTimeout(200); }
      if (step === 'clear') await endLevel(p, true);
      if (step === 'shop') await p.click('.screen:not([hidden]) [data-act=toShop]');
      if (step === 'garage') { await p.evaluate(() => SS.ACT.garage()); }
      await p.waitForTimeout(80);
      const r = await p.evaluate(() => {
        const out = [], vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null; };
        document.querySelectorAll('button').forEach(el => { if (!vis(el) || el.closest('[hidden]')) return; const b = el.getBoundingClientRect(); if (b.width < 1) return;
          if (b.right > innerWidth + 1 || b.left < -1) out.push(`ekran dışı "${el.textContent.slice(0, 20)}"`);
          if (b.height < 36) out.push(`küçük dokunma alanı ${Math.round(b.height)}px "${el.textContent.slice(0, 20)}"`); });
        const c = document.getElementById('game').getBoundingClientRect();
        return { out, fill: Math.round(c.width * c.height / (innerWidth * innerHeight) * 100) };
      });
      r.out.forEach(x => bad.push(`${step}: ${x}`));
      if (step === 'play' && r.fill < 90) bad.push(`oyun alanı ekranın %${r.fill}'i`);
    }
    check(!bad.length && !errs.length, `Yerleşim ${w}x${h}`, [...bad, ...errs].slice(0, 4).join(' | '));
    await ctx.close();
  }
  console.log(report.join('\n'));
  console.log(failed ? `\n${failed} kontrol başarısız.` : '\nBütün kontroller geçti.');
  await b.close(); process.exit(failed ? 1 : 0);
})();
