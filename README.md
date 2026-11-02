# Space Scrapper · CrazyGames edition

Swing your claw, grab space scrap, beat the quota. A short-session arcade game made for web game portals (CrazyGames), built from the scrap-hunt mechanic of [Space Scrapper](https://github.com/Ceomai/Space_Scrapper).

Pure HTML5 canvas + JavaScript. No framework, no build step, no external assets except the CrazyGames SDK. The upload package is ~240 KB.

## Oyun (Türkçe özet)

- **Tur:** Her seviyede ~45 saniye. Kancayı doğru açıda at, hurdayı çek, **kotayı** doldur.
- **Bölgeler:** 5 bölge (Asteroit Kuşağı → Gemi Mezarlığı → Gaz Devi → Korsan Sektörü → Kayıp Yıldız), her biri 3 seviye. İkinci turdan itibaren bütün bölgeler zenginleşir.
- **Saha koşulları:** Her seviyede biri gelir: sakin, güneş akıntısı, karanlık bölge, meteor yağmuru, yılan yuvası, balina göçü, korsan dronları, zengin damar, buz kuşağı, yuva.
- **Tehlikeler:** patlayıcı tanklar, ısıran taklitçi kutular, parlayan denizanaları. Kara kutulardan para, torpido, süre, güçlü vinç ya da kristal çıkar.
- **Dükkân (seviye arası):** torpido ve tek seviyelik destekler: kanca yağı, enerji içeceği, zaman kapsülü, şans yoncası, mücevher cilası, radar.
- **Garaj (kalıcı):** her turdan kazanılan parçalarla 6 yükseltme: kanca motoru, vinç, mıknatıs, oksijen tankı, torpido rafı, tarayıcı.
- **Diller:** İngilizce; Türkçe tarayıcıda Türkçe açılır, menüden değiştirilir.
- **Kontroller:** dokun / tıkla / Boşluk / ↓ = kancayı at; Torpido düğmesi / ↑ / T = çekilen yükü patlat; Esc / P = duraklat.

## CrazyGames integration (SDK v3)

| Requirement | How it is handled (`js/sdk.js`, `js/game.js`) |
|---|---|
| SDK script | `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in `index.html`; `SDK.init()` before anything else |
| Loading events | `loadingStart` / `loadingStop` around boot |
| Gameplay events | `gameplayStart` when a level runs or resumes; `gameplayStop` on pause, tab switch, level end, menus, ads |
| Midgame ads | Natural break only: at the start of level 3, then at most every second level. Game is paused and muted during ads |
| Rewarded ads (opt-in) | Double a level's cash (once per level) · +1 torpedo in the shop (once per visit) · retry a failed level (once per run) |
| Ad failure / ad blocker | Game never freezes; a short notice is shown; 45 s safety timeout |
| Happy time | Called when a level is cleared with 1.5× the quota |
| Save | CrazyGames data module (`SDK.data`) with `localStorage` fallback. Only game progress, no personal data |
| Audio | Respects the SDK's `muteAudio` setting; in-game sound toggle |
| Other ads / links | None. No external requests besides the SDK |
| Without SDK | Runs everywhere (local preview, other hosts): ads resolve as "not shown", events are no-ops |

Check the current requirements before submitting: https://docs.crazygames.com/

## Upload to CrazyGames

1. **Developer portal:** create an account at https://developer.crazygames.com.
2. **Build:** download the zip `space-scrapper-crazygames.zip` from https://github.com/Ceomai/Space-Scrapper-CrazyGames/releases/download/paket/space-scrapper-crazygames.zip (rebuilt by GitHub Actions on every update). To build it locally:
   ```bash
   zip -r space-scrapper-crazygames.zip index.html js icons
   ```
3. **Upload:** upload it as an HTML5 game. Cover images are in `promo/` (1920×1080, 800×1200, 800×800); regenerate them with `node tools/promo.js`.
4. **Launch:** the game goes through review and *Basic Launch*; with good playtime and retention it can move to *Full Launch*.

## Tests

```bash
npm install --no-save playwright@1.63.0
npx playwright install chromium
node tests/run.js
```

| File | What it checks |
|---|---|
| `tests/flow.js` | All screens with a mocked CrazyGames SDK: loading and gameplay events, midgame ad timing, three rewarded ads, ad failure, data-module save and reload, mute setting, no external requests or links, no-SDK mode, Turkish UI, layout on 7 screen sizes (overflow, tap targets ≥ 36 px, playfield fills the screen) |
| `tests/balance.js` | Balance bot plays whole runs (perfect or human-like aim) with 0 / mid / max garage, portrait and landscape |

Measured with the human-like bot (3 runs each): no garage ≈ level 8, mid garage ≈ level 10, full garage ≈ level 12; portrait and landscape within ±1 level. Filling the whole garage takes ≈ 12 runs.
