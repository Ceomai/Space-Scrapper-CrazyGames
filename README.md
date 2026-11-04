# Space Scrapper · CrazyGames edition

Aim your claw, fill salvage orders for picky clients, keep your rusty ship in one piece. A short-session arcade game made for web game portals (CrazyGames), built from the scrap-hunt mechanic of [Space Scrapper](https://github.com/Ceomai/Space_Scrapper).

Pure HTML5 canvas + JavaScript. No framework, no build step, no external assets except the CrazyGames SDK. The upload package is ~240 KB.

## Oyun (Türkçe özet)

- **Nişan al ve at:** Kanca sallanmaz; fareyle (ya da ←/→) nişan alınır, tıklayınca (ya da Boşluk) nişanlanan yöne fırlar. Kesikli nişan çizgisi kancanın ilk değeceği eşyayı gösterir; siparişe uyan eşya yeşil ✓ ile işaretlenir.
- **Dalış ve siparişler:** Her dalışta (35–60 sn) müşterilerden 3 sipariş gelir: "3 × Cıvata Yığını", "1 × Enerji Kristali", "₡300 değerinde Metal" gibi. Tamamlanan her sipariş ★ ve prim verir.
- **Gövde:** 3 can. Bir dalışta yeterli sipariş tamamlanmazsa (dalış 2–3: 1, 4–9: 2, sonrası: 3) gemi hasar alır. Can bitince koşu biter.
- **Modül seçimi (dalış arası):** 3 karttan biri seçilir; koşu boyunca sürer (hızlı motor, ağır vinç, mıknatıs bobini, oksijen, komisyoncu, kaya geri dönüşümü, şok kaplama, derin tarayıcı, sıralama zinciri).
- **Bırak:** Tutulan istenmeyen yük sağ tık / ↑ / Bırak düğmesiyle bırakılır.
- **Bölgeler ve saha koşulları:** 5 bölge; sakin, güneş rüzgârı, karanlık, meteor yağmuru, yılanlar, balina, korsan dronları, altın akını, buz alanı, yuva.
- **Öğretim:** İlk dalış oynanış içinde, görsel ve atlanabilir (Skip tutorial); bir kez gösterilir.
- **Garaj (kalıcı):** parçalarla 6 yükseltme: kanca motoru, vinç, mıknatıs, oksijen tankı, gövde kaplaması, ticaret lisansı.
- **Ses:** sentezlenmiş efektler ve prosedürel müzik (ayrı açılıp kapanır, SDK sessiz ayarına uyar).
- **Dil:** yalnızca İngilizce; tarayıcının otomatik çevirisi kapalı.
- **Kontroller:** fare/dokunma = nişan ve atış; ←/→ (A/D) nişan; Boşluk/↓/S atış; ↑/W/sağ tık bırak; P duraklat. Escape kullanılmaz (tarayıcıda tam ekrandan çıkar). Tuşlar fiziksel konumla okunur, AZERTY'de de çalışır.

## CrazyGames integration (SDK v3)

| Requirement | How it is handled (`js/sdk.js`, `js/game.js`) |
|---|---|
| SDK script | `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in `index.html`; `SDK.init()` before anything else |
| Loading events | `loadingStart` / `loadingStop` around boot |
| Gameplay events | `gameplayStart` when a dive runs or resumes; `gameplayStop` on pause, tab switch, dive end, menus, ads |
| Midgame ads | Natural break only: at the start of dive 3, then at most every second dive. Game is paused and muted during ads |
| Rewarded ads (opt-in) | Double a dive's cash (once per dive) · new module cards (once per pick) · repair the hull after a failed dive (once per run) |
| Ad failure / ad blocker | Game never freezes; a short notice is shown; 45 s safety timeout |
| Happy time | Called when all three orders of a dive are filled |
| Save | CrazyGames data module (`SDK.data`) with `localStorage` fallback. Only game progress, no personal data |
| Audio | Respects the SDK's `muteAudio` setting; separate sound and music toggles; audio starts only after the first click/key |
| Other ads / links | None. No external requests besides the SDK |
| Without SDK | Runs everywhere (local preview, other hosts): ads resolve as "not shown", events are no-ops |

Check the current requirements before submitting: https://docs.crazygames.com/

## Upload to CrazyGames

1. **Developer portal:** create an account at https://developer.crazygames.com.
2. **Build:** the CrazyGames uploader takes files, not archives or folders, so the game is also built as **one self-contained `index.html`** (all scripts and the icon embedded, ~110 KB):
   https://github.com/Ceomai/Space-Scrapper-CrazyGames/releases/download/paket/index.html
   Rebuilt by GitHub Actions on every update and tested with the same flow test. Build locally with `node tools/build-single.js` (→ `dist/index.html`). The multi-file zip is still in the same release.
3. **Upload:** drag that single `index.html` into the upload zone as an HTML5 game. Cover images are in `promo/` (1920×1080, 800×1200, 800×800); regenerate them with `node tools/promo.js`.
4. **Launch:** the game goes through review and *Basic Launch*; with good playtime and retention it can move to *Full Launch*.

## Tests

```bash
npm install --no-save playwright@1.63.0
npx playwright install chromium
node tests/run.js
```

| File | What it checks |
|---|---|
| `tests/flow.js` | All screens with a mocked CrazyGames SDK: loading and gameplay events, midgame ad timing, three rewarded ads, ad failure, data-module save and reload, mute setting, no external requests or links, no-SDK mode, English-only check (Turkish and German browsers, every screen, all 10 field conditions, every box/event/item text drawn on the canvas), layout on 7 screen sizes (overflow, tap targets ≥ 36 px, playfield fills the screen) |
| `tests/balance.js` | Aim bot plays whole runs ("good" = exact aim, orders first; "human" = aim error, reaction delay, sometimes ignores orders) with 0 / mid garage, landscape and portrait; fails if the human profile averages fewer than 5 or more than 60 dives |

Measured (`node tests/balance.js 2`): without garage ≈ 10–15 dives, with a mid garage ≈ 13–21 dives, landscape and portrait within a few dives. Real players are slower than the bot, so a first run usually ends around dive 6–10.
