// Space Scrapper (CrazyGames edition) — shared helpers, palettes, items, zones, field conditions and texts.
window.SS = window.SS || {};
(function(SS){
SS.rnd = (a, b) => a + Math.random() * (b - a);
SS.rint = (a, b) => Math.floor(SS.rnd(a, b + 1));
SS.pick = a => a[Math.floor(Math.random() * a.length)];
SS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
SS.mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
SS.THEMES = [{ id: 'space', pal: 'bright' }];
SS.RELICS = {};

SS.PAL = {
  bright: {
    space0: '#140c35', space1: '#3a1f6e', star: '#fff1e8', neb1: 'rgba(255,119,168,.28)', neb2: 'rgba(41,173,255,.22)',
    metal: '#c2c3c7', metalD: '#5f6b8a', metalL: '#fff1e8', crystal: '#5ef0ff', crystal2: '#ff77a8',
    rock: '#ab7a5a', rockD: '#5f4436', box: '#ffa300', boxD: '#ab5236', bug: '#00e436', bugD: '#008751',
    slime: '#c17bff', slimeD: '#83479f', tank: '#ff004d', tankD: '#7e2553', warn: '#ffec27',
    hull: '#ff8a3d', hullD: '#ab5236', hull2: '#ffccaa', glass: '#7ef3ff', rope: '#fff1e8', text: '#fff1e8',
    accent: '#ffec27', good: '#00e436', bad: '#ff004d', flame: '#ffa300', ground: '#83769c', groundD: '#5a4f78', pad: '#00e436',
    ui: '#1d2b53',
  },
  rust: {
    space0: '#070807', space1: '#1a1813', star: '#a9a28a', neb1: 'rgba(122,42,34,.22)', neb2: 'rgba(63,92,82,.18)',
    metal: '#8d8f87', metalD: '#43413a', metalL: '#c9c2a8', crystal: '#7fc9b8', crystal2: '#b35a4a',
    rock: '#5f5548', rockD: '#2e2a22', box: '#b4782f', boxD: '#5e3c19', bug: '#7c9a4e', bugD: '#3f5c32',
    slime: '#7a5a86', slimeD: '#463352', tank: '#c0392b', tankD: '#7a2a22', warn: '#d9a441',
    hull: '#7a6a55', hullD: '#433d31', hull2: '#b9ab8f', glass: '#6f9c8f', rope: '#c9c2a8', text: '#e6dfc8',
    accent: '#d9a441', good: '#8db255', bad: '#c0392b', flame: '#d98c2b', ground: '#433d31', groundD: '#2e2a22', pad: '#8db255',
    ui: '#1d1a14',
  },
};
// Piksel stilin sınırlı renk paleti (her mod için ayrı)
SS.PIXPAL = {
  bright: ['#000000', '#140c35', '#1d2b53', '#3a1f6e', '#7e2553', '#008751', '#ab5236', '#5f574f', '#5f6b8a', '#83769c', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#5ef0ff', '#ff77a8', '#ffccaa', '#c17bff', '#83479f', '#ab7a5a', '#5f4436', '#ff8a3d', '#5a4f78'],
  rust: ['#070807', '#1a1813', '#2e2a22', '#433d31', '#5f5548', '#7a6a55', '#8d8f87', '#b9ab8f', '#c9c2a8', '#e6dfc8', '#7a2a22', '#c0392b',
    '#5e3c19', '#b4782f', '#d98c2b', '#d9a441', '#3f5c52', '#6f9c8f', '#7fc9b8', '#3f5c32', '#7c9a4e', '#8db255', '#463352', '#7a5a86', '#b35a4a', '#43413a'],
};

/* ---------- items: r = hit radius, wt = weight (slows the winch), val = base value ---------- */
SS.ITEMS = {
  bolts:   { en: 'Bolt Pile',        tr: 'Vida Yığını',        r: 13, val: 30,  wt: 1.2 },
  plate:   { en: 'Hull Plate',       tr: 'Metal Levha',        r: 20, val: 80,  wt: 2.2 },
  sat:     { en: 'Satellite Wreck',  tr: 'Uydu Enkazı',        r: 34, val: 280, wt: 4.6 },
  part:    { en: 'Engine Part',      tr: 'Motor Parçası',      r: 16, val: 130, wt: 1.8 },
  rock:    { en: 'Small Asteroid',   tr: 'Küçük Asteroit',     r: 16, val: 12,  wt: 2.6 },
  boulder: { en: 'Giant Asteroid',   tr: 'Dev Asteroit',       r: 30, val: 35,  wt: 5.2 },
  crystal: { en: 'Energy Crystal',   tr: 'Enerji Kristali',    r: 11, val: 320, wt: 1,   gem: 1 },
  box:     { en: 'Black Box',        tr: 'Kara Kutu',          r: 16, val: 0,   wt: 1.5 },
  bug:     { en: 'Space Bug',        tr: 'Uzay Böceği',        r: 12, val: 25,  wt: 1,   move: 1 },
  slime:   { en: 'Crystal Slime',    tr: 'Kristalli Sümüksü',  r: 16, val: 340, wt: 1.3, move: 1, gem: 1 },
  tank:    { en: 'Explosive Tank',   tr: 'Patlayıcı Tank',     r: 15, val: 0,   wt: 1 },
  debris:  { en: 'Charred Scrap',    tr: 'Kömür Olmuş Hurda',  r: 8,  val: 4,   wt: .7 },
  gold:    { en: 'Gold Vein Rock',   tr: 'Altın Damarlı Kaya', r: 18, val: 210, wt: 3.8 },
  ice:     { en: 'Comet Ice',        tr: 'Buz Kometi Parçası', r: 14, val: 60,  wt: 1.1 },
  jelly:   { en: 'Nebula Jelly',     tr: 'Nebula Denizanası',  r: 15, val: 170, wt: .8 },
  egg:     { en: 'Alien Egg',        tr: 'Uzaylı Yumurtası',   r: 13, val: 260, wt: 1.4, gem: 1 },
  amber:   { en: 'Whale Amber',      tr: 'Balina Amberi',      r: 12, val: 420, wt: 1,   gem: 1 },
  mimic:   { en: 'Mimic Box',        tr: 'Taklitçi Kutu',      r: 16, val: 0,   wt: 1.5 },
};
SS.ZONES = [
  { id: 'belt',   en: 'Asteroid Belt',      tr: 'Asteroit Kuşağı',  mult: 1,
    mix: { bolts: 5, plate: 3, sat: 1, part: 1, rock: 5, boulder: 2, crystal: 1, box: 1, bug: 2 } },
  { id: 'yard',   en: 'Ship Graveyard',     tr: 'Gemi Mezarlığı',   mult: 1.25,
    mix: { bolts: 4, plate: 4, sat: 2, part: 3, rock: 2, boulder: 1, crystal: 1, box: 2, bug: 1, tank: 1 } },
  { id: 'gas',    en: 'Gas Giant Rings',    tr: 'Gaz Devi Halkası', mult: 1.5,
    mix: { bolts: 2, plate: 2, sat: 1, part: 1, rock: 4, boulder: 2, crystal: 3, box: 2, bug: 2, tank: 1, slime: 2 } },
  { id: 'pirate', en: 'Pirate Sector',      tr: 'Korsan Sektörü',   mult: 1.9,
    mix: { bolts: 2, plate: 3, sat: 2, part: 3, rock: 2, boulder: 2, crystal: 3, box: 3, bug: 1, tank: 3, slime: 2 } },
  { id: 'lost',   en: 'The Lost Star',      tr: 'Kayıp Yıldız',     mult: 2.4,
    mix: { bolts: 2, plate: 2, sat: 3, part: 3, rock: 1, boulder: 1, crystal: 4, box: 3, tank: 2, slime: 2 } },
];
SS.ZONE_EXTRA = { belt: { gold: .5, ice: 1 }, yard: { mimic: .6, gold: .4 }, gas: { jelly: 1, ice: .5 }, pirate: { mimic: .7, gold: 1 }, lost: { egg: 1, mimic: .5, jelly: .5 } };
/* Field conditions: one is rolled per level, weighted by zone */
SS.VARIANTS = [
  { id: 'calm',    w: { belt: 3, yard: 2, gas: 2, pirate: 1, lost: 1 } },
  { id: 'drift',   w: { belt: 2, yard: 2, gas: 2, pirate: 1, lost: 1 } },
  { id: 'dark',    w: { belt: 1, yard: 2, gas: 1, pirate: 1, lost: 2 } },
  { id: 'storm',   w: { belt: 2, yard: 1, gas: 1, pirate: 1, lost: 1 } },
  { id: 'eels',    w: { belt: 0, yard: 2, gas: 2, pirate: 1, lost: 2 } },
  { id: 'whale',   w: { belt: 1, yard: 0, gas: 2, pirate: 0, lost: 1 } },
  { id: 'raiders', w: { belt: 0, yard: 1, gas: 0, pirate: 3, lost: 1 } },
  { id: 'rich',    w: { belt: 1.5, yard: 1, gas: 1, pirate: 1.5, lost: 1 }, mix: m => { m.gold = (m.gold || 0) + 2; m.tank = (m.tank || 0) + 1; } },
  { id: 'frozen',  w: { belt: 2, yard: 0, gas: 1, pirate: 0, lost: 0 }, mix: m => { m.ice = (m.ice || 0) + 5; m.rock = Math.max(0, (m.rock || 0) - 2); } },
  { id: 'nursery', w: { belt: 0, yard: 0, gas: 3, pirate: 0, lost: 2 }, mix: m => { m.jelly = (m.jelly || 0) + 3; m.egg = (m.egg || 0) + 2; m.slime = Math.max(0, (m.slime || 0) - 1); } },
];

/* ---------- texts (English first; Turkish for Turkish browsers) ---------- */
SS.TEXT = {
  en: {
    play: 'Play', garage: 'Garage', continue: 'Continue', back: 'Back', level: 'Level', target: 'Target', time: 'Time', cash: 'Cash', best: 'Best',
    tapHint: 'Tap, click or press Space to fire the claw', torpHint: 'Torpedo blows up what you are dragging',
    torpedo: 'Torpedo', paused: 'Paused', resume: 'Resume', quit: 'Main menu', sound: 'Sound', on: 'On', off: 'Off',
    levelClear: 'Level cleared!', earned: 'Earned', next: 'Next level', shop: 'Space Shop', shopHint: 'Boosts last for the next level only.',
    buy: 'Buy', owned: 'Ready', skip: 'Continue', double: 'Watch ad: double this level\'s cash',
    failed: 'Quota missed', needed: 'Needed', retry: 'Watch ad: retry this level', gameOver: 'Game over', newBest: 'New best!',
    runSummary: 'Run summary', reached: 'Reached level', total: 'Total scrap value', parts: 'Parts earned', partsShort: 'Parts', playAgain: 'Play again',
    adBreak: 'Short break…', adFail: 'No ad available right now. Try again later.', garageHint: 'Permanent upgrades, paid with Parts from every run.',
    max: 'MAX', freeTorp: 'Watch ad: +1 torpedo', zone: 'Zone', loading: 'Loading…',
    lv: n => `Lv ${n}`,
    zoneNames: {}, // filled from SS.ZONES
    var: { calm: ['Calm field', 'Quiet space today. Take your time.'], drift: ['Solar drift', 'Wind pushes everything sideways. Lead your shots.'],
      dark: ['Dark sector', 'Only the area around your claw is lit. Crystals glimmer.'], storm: ['Meteor shower', 'Red arrows warn of meteors. A hit cuts your rope.'],
      eels: ['Star eel nest', 'Eels push your claw and snatch your haul. Wait for them to pass.'], whale: ['Whale migration', 'A space whale passes by. It may drop precious amber.'],
      raiders: ['Pirate drones', 'Drones try to steal valuables. Knock them down with your claw.'], rich: ['Rich vein', 'Gold-veined rocks everywhere, and more tanks.'],
      frozen: ['Ice belt', 'Comet ice is light and quick to reel in.'], nursery: ['Nursery', 'Don\'t touch glowing jellies. Eggs are very valuable.'] },
    boxes: { cash: 'Cash!', torp: '+1 Torpedo', time: '+5 seconds', strength: 'Power reel!', crystal: 'Crystal inside!', trap: 'Confetti!' },
    events: { boom: 'BOOM!', mimic: 'Mimic bite! −4s', jelly: 'Zapped! −3s', meteor: 'Meteor cut the rope!', eelPush: 'Eel pushed the claw', eelSnatch: 'Eel snatched it!', droneDown: 'Drone down!', droneSteal: 'Drone stole it!', amber: 'The whale dropped amber!' },
    items: {},
    boosts: { torp: ['Torpedo', '+1 torpedo for this run'], oil: ['Claw Oil', 'Claw shoots 40% faster next level'], strength: ['Power Drink', 'Reel in 50% faster next level'],
      time: ['Time Capsule', '+10 seconds next level'], clover: ['Lucky Clover', 'Black boxes give better loot next level'], polish: ['Gem Polish', 'Gems are worth double next level'],
      radar: ['Radar Scan', 'See black box contents and mimics next level'] },
    ups: { claw: ['Claw Motor', 'Faster claw shot'], winch: ['Winch', 'Reel heavy loot faster'], magnet: ['Magnet', 'Bigger grab reach'], time: ['Oxygen Tank', '+4 seconds every level'],
      torp: ['Torpedo Rack', '+1 starting torpedo'], luck: ['Scanner', 'Better black box loot'] },
  },
  tr: {
    play: 'Oyna', garage: 'Garaj', continue: 'Devam', back: 'Geri', level: 'Seviye', target: 'Hedef', time: 'Süre', cash: 'Para', best: 'En iyi',
    tapHint: 'Kancayı atmak için dokun, tıkla ya da Boşluk\'a bas', torpHint: 'Torpido, çektiğin yükü patlatır',
    torpedo: 'Torpido', paused: 'Duraklatıldı', resume: 'Devam et', quit: 'Ana menü', sound: 'Ses', on: 'Açık', off: 'Kapalı',
    levelClear: 'Seviye tamam!', earned: 'Kazanç', next: 'Sonraki seviye', shop: 'Uzay Dükkânı', shopHint: 'Destekler yalnızca sonraki seviyede geçerli.',
    buy: 'Al', owned: 'Hazır', skip: 'Devam', double: 'Reklam izle: bu seviyenin parasını ikiye katla',
    failed: 'Kota tutmadı', needed: 'Gereken', retry: 'Reklam izle: seviyeyi tekrar dene', gameOver: 'Oyun bitti', newBest: 'Yeni rekor!',
    runSummary: 'Tur özeti', reached: 'Ulaşılan seviye', total: 'Toplam hurda değeri', parts: 'Kazanılan parça', partsShort: 'Parça', playAgain: 'Tekrar oyna',
    adBreak: 'Kısa bir ara…', adFail: 'Şu an reklam yok. Sonra tekrar dene.', garageHint: 'Kalıcı yükseltmeler; her turdan kazanılan parçalarla alınır.',
    max: 'MAKS', freeTorp: 'Reklam izle: +1 torpido', zone: 'Bölge', loading: 'Yükleniyor…',
    lv: n => `Sv ${n}`,
    zoneNames: {},
    var: { calm: ['Sakin saha', 'Bugün uzay sessiz. Acele etme.'], drift: ['Güneş akıntısı', 'Rüzgâr her şeyi yana itiyor. Önden nişan al.'],
      dark: ['Karanlık bölge', 'Yalnızca kancanın etrafı aydınlık. Kristaller parlar.'], storm: ['Meteor yağmuru', 'Kırmızı oklar meteor habercisi. Çarparsa ip kopar.'],
      eels: ['Yılan yuvası', 'Yılanlar kancayı iter ve yükü kapar. Geçmelerini bekle.'], whale: ['Balina göçü', 'Bir uzay balinası geçiyor; değerli amber bırakabilir.'],
      raiders: ['Korsan dronları', 'Dronlar değerli parçaları çalar. Kancayla düşür.'], rich: ['Zengin damar', 'Altın damarlı kayalar her yerde; tanklar da çok.'],
      frozen: ['Buz kuşağı', 'Buz kometi parçaları hafif ve hızlı toplanır.'], nursery: ['Yuva', 'Parlayan denizanasına dokunma. Yumurtalar çok değerli.'] },
    boxes: { cash: 'Para!', torp: '+1 Torpido', time: '+5 saniye', strength: 'Güçlü vinç!', crystal: 'İçinden kristal çıktı!', trap: 'Konfeti!' },
    events: { boom: 'BUM!', mimic: 'Taklitçi ısırdı! −4 sn', jelly: 'Çarpıldın! −3 sn', meteor: 'Meteor ipi kopardı!', eelPush: 'Yılan kancayı itti', eelSnatch: 'Yılan kaptı!', droneDown: 'Dron düştü!', droneSteal: 'Dron çaldı!', amber: 'Balina amber bıraktı!' },
    items: {},
    boosts: { torp: ['Torpido', 'Bu tur için +1 torpido'], oil: ['Kanca Yağı', 'Sonraki seviyede kanca %40 hızlı'], strength: ['Enerji İçeceği', 'Sonraki seviyede vinç %50 hızlı'],
      time: ['Zaman Kapsülü', 'Sonraki seviyede +10 saniye'], clover: ['Şans Yoncası', 'Sonraki seviyede kara kutular daha cömert'], polish: ['Mücevher Cilası', 'Sonraki seviyede değerli taşlar iki kat'],
      radar: ['Radar Taraması', 'Sonraki seviyede kutu içleri ve taklitçiler görünür'] },
    ups: { claw: ['Kanca Motoru', 'Daha hızlı kanca atışı'], winch: ['Vinç', 'Ağır yükü daha hızlı çeker'], magnet: ['Mıknatıs', 'Daha geniş yakalama alanı'], time: ['Oksijen Tankı', 'Her seviyede +4 saniye'],
      torp: ['Torpido Rafı', 'Başlangıçta +1 torpido'], luck: ['Tarayıcı', 'Kara kutulardan daha iyi ganimet'] },
  },
};
for (const L of ['en', 'tr']) { for (const z of SS.ZONES) SS.TEXT[L].zoneNames[z.id] = z[L]; for (const k in SS.ITEMS) SS.TEXT[L].items[k] = SS.ITEMS[k][L]; }
})(window.SS);
