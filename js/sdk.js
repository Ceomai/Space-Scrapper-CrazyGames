// CrazyGames SDK v3 wrapper. Every call is safe without the SDK (local preview, ad blockers, other hosts):
// ads resolve as "not shown", data falls back to localStorage, gameplay events become no-ops.
// SDK reference: https://docs.crazygames.com/sdk/  (game events, ads, data module)
(function(SS){
const KEY = 'space-scrapper-cg';
const cg = () => (window.CrazyGames && window.CrazyGames.SDK) || null;
const P = SS.Platform = { env: 'none', ready: false, inAd: false, gameplay: false, muted: false, listeners: [], rewardedOk: true, lastAdError: null };
// Rewarded buttons are only shown when an ad can actually play: SDK present, and no rewarded ad has failed this session
// (e.g. ads are disabled during Basic Launch). They come back automatically on the next session.
P.canReward = () => !!cg() && P.rewardedOk;
// Diagnostics: every SDK call and result is kept in P.log and printed to the console with a [CrazyGames] prefix.
// In game: press Shift+D to see it (useful in the CrazyGames QA tool).
P.log = [];
const note = (...a) => { const line = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); P.log.push(`${new Date().toISOString().slice(11, 19)} ${line}`); if (P.log.length > 60) P.log.shift(); try { console.info('[CrazyGames]', ...a); } catch (e) {} };
P.note = note;

P.init = async () => {
  const sdk = cg();
  note('sdk script', sdk ? 'found' : 'NOT FOUND');
  if (!sdk) return P.env;
  try {
    await sdk.init();
    P.env = sdk.environment || 'unknown';
    note('init ok, environment =', P.env);
  } catch (e) { P.initError = String(e && e.message || e); note('init FAILED:', P.initError); }
  // As long as the SDK script is on the page we keep calling it; any failure is caught and logged.
  P.ready = true;
  try { const st = sdk.game.settings; if (st && typeof st.muteAudio === 'boolean') P.muted = st.muteAudio; } catch (e) {}
  try { sdk.game.addSettingsChangeListener(st => { if (st && typeof st.muteAudio === 'boolean') { P.muted = st.muteAudio; note('settings: muteAudio =', st.muteAudio); P.listeners.forEach(f => f()); } }); } catch (e) {}
  return P.env;
};
const call = (name, fn) => { const sdk = cg(); if (!sdk) return; try { fn(sdk); note(name); } catch (e) { note(name, 'FAILED:', String(e && e.message || e)); } };
P.loadingStart = () => call('loadingStart', s => s.game.loadingStart());
P.loadingStop = () => call('loadingStop', s => s.game.loadingStop());
P.gameplayStart = () => { if (P.gameplay || P.inAd) return; P.gameplay = true; call('gameplayStart', s => s.game.gameplayStart()); };
P.gameplayStop = () => { if (!P.gameplay) return; P.gameplay = false; call('gameplayStop', s => s.game.gameplayStop()); };
P.happytime = () => call('happytime', s => s.game.happytime());

// type: 'midgame' | 'rewarded'. Resolves true only when the ad finished (a rewarded ad grants its reward only then).
P.ad = type => new Promise(resolve => {
  const sdk = cg();
  if (!sdk) { note('ad', type, 'skipped: no SDK on page'); return resolve(false); }
  let done = false; const finish = ok => { if (done) return; done = true; P.inAd = false; SS.onAdEnd && SS.onAdEnd(); resolve(ok); };
  note('requestAd', type);
  try {
    sdk.ad.requestAd(type, {
      adStarted: () => { P.inAd = true; note('adStarted', type); SS.onAdStart && SS.onAdStart(); },
      adFinished: () => { note('adFinished', type); finish(true); },
      adError: err => { P.lastAdError = err; note('adError', type, err); if (type === 'rewarded') P.rewardedOk = false; finish(false); },
    });
  } catch (e) { note('requestAd', type, 'THREW:', String(e && e.message || e)); finish(false); }
  setTimeout(() => { if (!done) note('ad', type, 'timeout'); finish(false); }, 45000); // never leave the game frozen
});

// Persistent data: CrazyGames data module (cloud-synced for logged-in players) or localStorage
P.load = () => {
  let raw = null;
  try { const sdk = cg(); if (P.ready && sdk && sdk.data) raw = sdk.data.getItem(KEY); } catch (e) {}
  if (raw == null) { try { raw = localStorage.getItem(KEY); } catch (e) {} }
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
};
P.save = obj => {
  const raw = JSON.stringify(obj);
  try { const sdk = cg(); if (P.ready && sdk && sdk.data) sdk.data.setItem(KEY, raw); } catch (e) {}
  try { localStorage.setItem(KEY, raw); } catch (e) {}
};
})(window.SS);
