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
  bolts:   { name: 'Bolt Pile',        r: 13, val: 30,  wt: 1.2 },
  plate:   { name: 'Hull Plate',        r: 20, val: 80,  wt: 2.2 },
  sat:     { name: 'Satellite Wreck',        r: 34, val: 280, wt: 4.6 },
  part:    { name: 'Engine Part',      r: 16, val: 130, wt: 1.8 },
  rock:    { name: 'Small Asteroid',     r: 16, val: 12,  wt: 2.6 },
  boulder: { name: 'Giant Asteroid',       r: 30, val: 35,  wt: 5.2 },
  crystal: { name: 'Energy Crystal',    r: 11, val: 320, wt: 1,   gem: 1 },
  box:     { name: 'Flight Recorder',    r: 16, val: 150, wt: 1.5 },
  bug:     { name: 'Space Bug',        r: 12, val: 25,  wt: 1,   move: 1 },
  slime:   { name: 'Crystal Slime',  r: 16, val: 340, wt: 1.3, move: 1, gem: 1 },
  tank:    { name: 'Explosive Tank',     r: 15, val: 0,   wt: 1 },
  debris:  { name: 'Charred Scrap',  r: 8,  val: 4,   wt: .7 },
  gold:    { name: 'Gold Vein Rock', r: 18, val: 210, wt: 3.8 },
  ice:     { name: 'Comet Ice', r: 14, val: 60,  wt: 1.1 },
  jelly:   { name: 'Nebula Jelly',  r: 15, val: 170, wt: .8 },
  egg:     { name: 'Alien Egg',   r: 13, val: 260, wt: 1.4, gem: 1 },
  amber:   { name: 'Whale Amber',      r: 12, val: 420, wt: 1,   gem: 1 },
  mimic:   { name: 'Mimic Recorder', r: 16, val: 0,   wt: 1.5 },
};
SS.ZONES = [
  { id: 'belt',   name: 'Asteroid Belt',  mult: 1,
    mix: { bolts: 5, plate: 3, sat: 1, part: 1, rock: 5, boulder: 2, crystal: 1, box: 1, bug: 2 } },
  { id: 'yard',   name: 'Ship Graveyard',   mult: 1.25,
    mix: { bolts: 4, plate: 4, sat: 2, part: 3, rock: 2, boulder: 1, crystal: 1, box: 2, bug: 1, tank: 1 } },
  { id: 'gas',    name: 'Gas Giant Rings', mult: 1.5,
    mix: { bolts: 2, plate: 2, sat: 1, part: 1, rock: 4, boulder: 2, crystal: 3, box: 2, bug: 2, tank: 1, slime: 2 } },
  { id: 'pirate', name: 'Pirate Sector',   mult: 1.9,
    mix: { bolts: 2, plate: 3, sat: 2, part: 3, rock: 2, boulder: 2, crystal: 3, box: 3, bug: 1, tank: 3, slime: 2 } },
  { id: 'lost',   name: 'The Lost Star',     mult: 2.4,
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

/* ---------- order categories: what a client can ask for by value ---------- */
SS.CATS = {
  metal:   { name: 'Metal', kinds: ['bolts', 'plate', 'sat', 'part', 'debris'] },
  mineral: { name: 'Minerals', kinds: ['rock', 'boulder', 'gold', 'ice'] },
  bio:     { name: 'Rare finds', kinds: ['crystal', 'slime', 'egg', 'jelly', 'amber', 'bug'] },
};
SS.catOf = kind => Object.keys(SS.CATS).find(c => SS.CATS[c].kinds.includes(kind)) || null;
/* ---------- run modules: one of three is picked after every dive ---------- */
SS.MODS = [
  { id: 'motor',    max: 3, icon: '⇣', name: 'Overdrive Motor', desc: 'Claw shoots 20% faster' },
  { id: 'winch',    max: 3, icon: '⟲', name: 'Heavy Winch',     desc: 'Reel in 25% faster' },
  { id: 'coil',     max: 3, icon: '◎', name: 'Magnet Coil',     desc: 'Wider grab reach' },
  { id: 'oxygen',   max: 3, icon: '◷', name: 'Oxygen Reserve',  desc: '+6 seconds every dive' },
  { id: 'broker',   max: 3, icon: '★', name: 'Salvage Broker',  desc: 'Orders pay 20% more' },
  { id: 'recycler', max: 2, icon: '♻', name: 'Rock Recycler',   desc: 'Minerals are worth 60% more' },
  { id: 'plating',  max: 1, icon: '⛨', name: 'Shock Plating',   desc: 'Jellies, mimics and eels can\'t stop you' },
  { id: 'scanner',  max: 1, icon: '⌖', name: 'Deep Scanner',    desc: 'See values while aiming, wider light in dark zones' },
  { id: 'chain',    max: 1, icon: '⛓', name: 'Sorting Chain',   desc: 'Same-category catches in a row: +10% each, up to +50%' },
];

/* ---------- texts: the CrazyGames edition is English only ---------- */
SS.TEXT = {
  en: {
    play: 'Play', garage: 'Garage', continue: 'Continue', back: 'Back', best: 'Best', cash: 'Cash', sound: 'Sound', music: 'Music', on: 'On', off: 'Off',
    paused: 'Paused', resume: 'Resume', quit: 'Main menu', loading: 'Loading…', max: 'MAX', partsShort: 'Parts',
    dive: n => `Dive ${n}`, orders: 'Orders', drop: 'Drop',
    tagline: 'Aim the claw, fill salvage orders, keep your ship in one piece.',
    tut: { aim: 'Aim at the bolts', fire: 'Fire!', orders: 'Fill orders for bonus cash', skip: 'Skip tutorial', drop: 'Grabbed junk? Drop it' },
    keys: { aim: 'Mouse  or  ← →', fire: 'Click  or  Space', drop: 'Right-click  or  ↑' },
    diveDone: 'Dive complete', hullHit: 'Hull damaged', wrecked: 'Ship wrecked', need: n => `Fill at least ${n} order${n > 1 ? 's' : ''} to avoid hull damage`,
    earned: 'Earned', double: 'Watch ad: double this dive\'s cash', repair: 'Watch ad: repair the hull', reroll: 'Watch ad: new modules',
    pick: 'Pick a module', pickHint: 'Modules last for this run.', next: n => `Next: Dive ${n}`,
    runSummary: 'Run summary', newBest: 'New best!', reached: 'Dives', total: 'Total cash', starsT: 'Orders filled', parts: 'Parts earned', playAgain: 'Play again',
    adFail: 'Ads aren\'t available right now.', garageHint: 'Permanent upgrades, paid with Parts from every run.',
    order: { kind: (n, name) => `${n} × ${name}`, cat: (v, name) => `₡${v} of ${name}` },
    zoneNames: {},
    var: { calm: ['Calm Field', 'Quiet space today.'], drift: ['Solar Wind', 'Everything drifts sideways. Aim ahead.'],
      dark: ['Dark Sector', 'Only the area around your claw is lit.'], storm: ['Meteor Shower', 'Red arrows warn of meteors. A hit cuts your rope.'],
      eels: ['Space Eels', 'Eels push your claw away and steal your haul.'], whale: ['Whale Crossing', 'A space whale drops precious amber.'],
      raiders: ['Pirate Drones', 'Drones steal valuables. Hit them with your claw.'], rich: ['Gold Rush', 'Gold everywhere, but more explosive tanks too.'],
      frozen: ['Ice Field', 'Comet ice is light and quick to reel in.'], nursery: ['Alien Nursery', 'Don\'t touch glowing jellies. Eggs are worth a lot.'] },
    events: { boom: 'BOOM!', mimic: 'Mimic bite! −4s', jelly: 'Zapped! −3s', meteor: 'Meteor cut the rope!', eelPush: 'Eel pushed the claw', eelSnatch: 'Eel snatched it!', droneDown: 'Drone down!', droneSteal: 'Drone stole it!', amber: 'The whale dropped amber!', orderDone: 'Order filled!', dropped: 'Dropped' },
    items: {},
    ups: { claw: ['Claw Motor', 'Faster claw shot'], winch: ['Winch', 'Reel heavy loot faster'], magnet: ['Magnet', 'Bigger grab reach'], time: ['Oxygen Tank', '+4 seconds every dive'],
      hull: ['Hull Plating', '+1 starting hull point'], broker: ['Trade License', 'Orders pay 8% more'] },
  }
};
for (const z of SS.ZONES) SS.TEXT.en.zoneNames[z.id] = z.name; for (const k in SS.ITEMS) SS.TEXT.en.items[k] = SS.ITEMS[k].name;
})(window.SS);
