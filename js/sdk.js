// CrazyGames SDK v3 wrapper. Every call is safe without the SDK (local preview, ad blockers, other hosts):
// ads resolve as "not shown", data falls back to localStorage, gameplay events become no-ops.
// SDK reference: https://docs.crazygames.com/sdk/  (game events, ads, data module)
(function(SS){
const KEY = 'space-scrapper-cg';
const cg = () => (window.CrazyGames && window.CrazyGames.SDK) || null;
const P = SS.Platform = { env: 'none', ready: false, inAd: false, gameplay: false, muted: false, listeners: [] };

P.init = async () => {
  const sdk = cg();
  if (sdk) {
    try {
      await sdk.init();
      P.env = sdk.environment || 'crazygames'; // 'local' | 'crazygames' | 'disabled'
      P.ready = P.env !== 'disabled';
      try { const s = sdk.game.settings; if (s && typeof s.muteAudio === 'boolean') P.muted = s.muteAudio; } catch (e) {}
      try { sdk.game.addSettingsChangeListener(s => { if (s && typeof s.muteAudio === 'boolean') { P.muted = s.muteAudio; P.listeners.forEach(f => f()); } }); } catch (e) {}
    } catch (e) { P.env = 'none'; P.ready = false; }
  }
  return P.env;
};
const call = (fn) => { try { const sdk = cg(); if (P.ready && sdk) fn(sdk); } catch (e) {} };
P.loadingStart = () => call(s => s.game.loadingStart());
P.loadingStop = () => call(s => s.game.loadingStop());
P.gameplayStart = () => { if (P.gameplay || P.inAd) return; P.gameplay = true; call(s => s.game.gameplayStart()); };
P.gameplayStop = () => { if (!P.gameplay) return; P.gameplay = false; call(s => s.game.gameplayStop()); };
P.happytime = () => call(s => s.game.happytime());

// type: 'midgame' | 'rewarded'. Resolves true only when a rewarded ad finished.
P.ad = type => new Promise(resolve => {
  const sdk = cg();
  if (!P.ready || !sdk) return resolve(false);
  let done = false; const finish = ok => { if (done) return; done = true; P.inAd = false; SS.onAdEnd && SS.onAdEnd(); resolve(ok); };
  try {
    sdk.ad.requestAd(type, {
      adStarted: () => { P.inAd = true; SS.onAdStart && SS.onAdStart(); },
      adFinished: () => finish(true),
      adError: () => finish(false),
    });
  } catch (e) { finish(false); }
  setTimeout(() => finish(false), 45000); // never leave the game frozen
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
