// ═══════════════════════════════════════════════════
// GLOBALS SHIM — Functions that core modules depend on
// These were originally in index.html of the 2D version.
// Provides stubs and real implementations for the Phaser port.
// ═══════════════════════════════════════════════════

// ── Safe DOM stubs (core modules reference 274 DOM elements that don't exist in Phaser) ──
const _realGetById = document.getElementById.bind(document);
document.getElementById = function(id) {
  const el = _realGetById(id);
  if (el) return el;
  // Return a safe stub element so .style, .textContent, .innerHTML don't crash
  return {
    style: new Proxy({}, { set: () => true, get: () => '' }),
    textContent: '', innerHTML: '', innerText: '',
    classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{}, contains: ()=>false },
    setAttribute: ()=>{}, getAttribute: ()=>null, removeAttribute: ()=>{},
    addEventListener: ()=>{}, removeEventListener: ()=>{},
    appendChild: ()=>{}, removeChild: ()=>{}, remove: ()=>{},
    querySelectorAll: ()=>[], querySelector: ()=>null,
    children: [], childNodes: [], parentElement: null,
    getBoundingClientRect: ()=>({top:0,left:0,width:0,height:0,right:0,bottom:0}),
    offsetWidth: 0, offsetHeight: 0,
    dataset: {},
    checked: false, value: '',
    _stub: true
  };
};

// Also stub querySelectorAll for bulk DOM queries
const _realQSA = document.querySelectorAll.bind(document);
document.querySelectorAll = function(sel) {
  try { return _realQSA(sel); } catch(e) { return []; }
};

// ── Constants from index.html ──
const TILE = 32;
const WORLD_W = 110;
const WORLD_H = 85; // Match 2D version exactly

// ═══ ZONE STATE ═══
// G.currentZone tracks which zone the player is in (persisted in save).
// HUB, HUB_MEADOW, etc. are now mutable — updated on zone transitions.
let HUB = { x: 15, y: 20 };
let HUB_MEADOW = { x: 28, y: 25 };
let HUB_VOLCANIC = { x: 30, y: 28 };
let HUB_DARK = { x: 25, y: 20 };

// Update HUB constants to match the active zone's hub positions
function _updateHubsForZone(zoneId) {
  if (typeof ZONE_HUBS !== 'undefined') {
    HUB = ZONE_HUBS[zoneId] || ZONE_HUBS.frost_valley;
    HUB_MEADOW = ZONE_HUBS.rolling_hills;
    HUB_VOLCANIC = ZONE_HUBS.volcanic_isles;
    HUB_DARK = ZONE_HUBS.dark_castle;
  }
}

// worldMap declared + populated by world-gen.js (generateWorld function)

// Canvas stub (some modules reference a canvas context for rendering)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// NOTE: spiritWisps, roamingEnemies, etc. are declared in their own
// core modules (gathering.js, world-events.js). Do NOT redeclare here.

// ── Day seed for daily resets ──
// NOTE: getDaySeed() is also declared in quests.js (same logic). The quests.js
// version will silently overwrite this one since both are function declarations.
function getDaySeed() { return Math.floor(Date.now() / 86400000); }

// ── Time of day cycle (10-minute loop) ──
function getTimeOfDay() {
  const cyclePos = (Date.now() / 1000 / 60) % 10;
  let phase, progress, nightFactor;
  if (cyclePos < 2) { phase = 'dawn'; progress = cyclePos / 2; nightFactor = 1 - progress; }
  else if (cyclePos < 5) { phase = 'day'; progress = (cyclePos - 2) / 3; nightFactor = 0; }
  else if (cyclePos < 7) { phase = 'dusk'; progress = (cyclePos - 5) / 2; nightFactor = progress; }
  else { phase = 'night'; progress = (cyclePos - 7) / 3; nightFactor = 1; }
  return { phase, progress, nightFactor };
}

// ── Skill system ──
// NOTE: hasSkill() is also declared in professions.js with better logic.
// The professions.js version will overwrite this one (function declarations hoist).
function hasSkill(skillId) {
  return G.unlockedSkills && G.unlockedSkills.includes(skillId);
}

// ── Zone detection ──
// getCurrentZone returns the ENCOUNTER_ZONES index (or -1 if not in any zone).
// Used by gathering.js, crafting.js, world-events.js, battle.js.
function getCurrentZone(px, py) {
  const tileX = Math.floor(px);
  const tileY = Math.floor(py);
  for (let i = 0; i < ENCOUNTER_ZONES.length; i++) {
    const z = ENCOUNTER_ZONES[i];
    if (tileX >= z.x && tileX < z.x + z.w && tileY >= z.y && tileY < z.y + z.h) {
      return i;
    }
  }
  return -1;
}

// getCurrentRegion returns the region name string (frost_valley, rolling_hills, etc.).
// Now each zone IS a region — the entire map is one region.
function getCurrentRegion(px, py) {
  return (G && G.currentZone) ? G.currentZone : 'frost_valley';
}

// ── Notification system (Phaser scene handles display) ──
let _notifyCallback = null;
function notify(text) {
  console.log('[NOTIFY]', text);
  if (_notifyCallback) _notifyCallback(text);
}
function notifyDiscovery(text) { notify(text); }
function notifyAmbient(text) { notify(text); }

// ── SFX stubs (replace with Phaser audio later) ──
const SFX = {
  click: () => {},
  encounterStart: () => {},
  hit: () => {},
  miss: () => {},
  ko: () => {},
  heal: () => {},
  craftSuccess: () => {},
  craftFail: () => {},
  levelUp: () => {},
  notify: () => {},
  collect: () => {},
  equip: () => {},
  sell: () => {},
  buy: () => {},
  gatherStart: () => {},
  gatherComplete: () => {},
  diceRoll: () => {},
  commBlip: () => {},
  victory: () => {},
  defeat: () => {},
};

// ── Procedural SFX via Web Audio API (no audio files needed) ──
const GameAudio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { console.warn('[GameAudio] Web Audio not available'); }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(fn) {
    const ac = getCtx();
    if (!ac) return;
    try { fn(ac); } catch (e) { /* swallow */ }
  }

  return {
    // Short harsh buzz — enemy takes damage
    hit() {
      play(ac => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(200, ac.currentTime);
        o.frequency.linearRampToValueAtTime(80, ac.currentTime + 0.08);
        g.gain.setValueAtTime(0.25, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.12);
      });
    },

    // Lower descending tone — player takes damage
    hurt() {
      play(ac => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, ac.currentTime);
        o.frequency.linearRampToValueAtTime(100, ac.currentTime + 0.2);
        g.gain.setValueAtTime(0.2, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.25);
      });
    },

    // Ascending chime — healing
    heal() {
      play(ac => {
        const notes = [523, 659, 784]; // C5, E5, G5
        notes.forEach((freq, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ac.currentTime + i * 0.06);
          g.gain.setValueAtTime(0, ac.currentTime + i * 0.06);
          g.gain.linearRampToValueAtTime(0.15, ac.currentTime + i * 0.06 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.06 + 0.2);
          o.connect(g).connect(ac.destination);
          o.start(ac.currentTime + i * 0.06);
          o.stop(ac.currentTime + i * 0.06 + 0.2);
        });
      });
    },

    // Ascending arpeggio — level up celebration
    levelUp() {
      play(ac => {
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ac.currentTime + i * 0.08);
          g.gain.setValueAtTime(0, ac.currentTime + i * 0.08);
          g.gain.linearRampToValueAtTime(0.18, ac.currentTime + i * 0.08 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.08 + 0.3);
          o.connect(g).connect(ac.destination);
          o.start(ac.currentTime + i * 0.08);
          o.stop(ac.currentTime + i * 0.08 + 0.3);
        });
      });
    },

    // Quick bright pip — wisp/loot pickup
    collect() {
      play(ac => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ac.currentTime);
        o.frequency.linearRampToValueAtTime(1320, ac.currentTime + 0.08);
        g.gain.setValueAtTime(0.15, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.12);
      });
    },

    // Soft click — menu open
    menuOpen() {
      play(ac => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(660, ac.currentTime);
        g.gain.setValueAtTime(0.08, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.06);
      });
    },

    // Major chord swell — victory
    victory() {
      play(ac => {
        const chord = [523, 659, 784]; // C5, E5, G5 major triad
        chord.forEach(freq => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ac.currentTime);
          g.gain.setValueAtTime(0, ac.currentTime);
          g.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.1);
          g.gain.setValueAtTime(0.12, ac.currentTime + 0.4);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
          o.connect(g).connect(ac.destination);
          o.start(); o.stop(ac.currentTime + 0.8);
        });
      });
    },

    // Minor chord descent — defeat
    defeat() {
      play(ac => {
        const chord = [493, 587, 740]; // B4, D5, F#5 diminished feel
        chord.forEach((freq, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, ac.currentTime);
          o.frequency.linearRampToValueAtTime(freq * 0.7, ac.currentTime + 0.6);
          g.gain.setValueAtTime(0, ac.currentTime);
          g.gain.linearRampToValueAtTime(0.1, ac.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.7);
          o.connect(g).connect(ac.destination);
          o.start(); o.stop(ac.currentTime + 0.7);
        });
      });
    },

    // Quick rattle — dice tumble
    dice() {
      play(ac => {
        for (let i = 0; i < 4; i++) {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(300 + Math.random() * 400, ac.currentTime + i * 0.035);
          g.gain.setValueAtTime(0.06, ac.currentTime + i * 0.035);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.035 + 0.03);
          o.connect(g).connect(ac.destination);
          o.start(ac.currentTime + i * 0.035);
          o.stop(ac.currentTime + i * 0.035 + 0.03);
        }
      });
    },
  };
})();

// ── Music stubs ──
const Music = {
  current: null,
  play: (track) => { Music.current = track; console.log('[Music] Playing:', track); },
  stop: () => { Music.current = null; },
  playJingle: (name) => { console.log('[Music] Jingle:', name); },
};

// ── Battle overlay stubs (Phaser BattleScene handles rendering) ──
// These MUST be no-ops — the 2D battle.js + npcs.js call them but
// in Phaser we use BattleScene instead. If these do anything, they
// crash because the DOM elements don't exist.
function showBattleOverlay() { console.log('[Stub] showBattleOverlay — Phaser handles this'); }
function hideBattleOverlay() {}
function renderBattle() { console.log('[Stub] renderBattle — Phaser handles this'); }
function showWildAppearedSplash(name) { console.log(`[Splash] Wild ${name} appeared!`); }
var battleFledThisSession = false;
var uid = 'local_' + Math.random().toString(36).substr(2, 9);
// ENCOUNTER_ZONES declared in world-gen.js

// ── Accessory effects ──
function applyAccessoryBattleEffects() {
  if (!B || !G.equipped) return;
  // Ember Stone: +1 Sacred Fire at battle start
  if (G.equipped.accessory?.name?.includes('Ember')) {
    B.resources.sacredFire = (B.resources.sacredFire || 0) + 1;
    B.player.resources.sacredFire = (B.player.resources.sacredFire || 0) + 1;
  }
}

// ── Title tracking ──
function checkAndNotifyTitles() {
  if (!G.rep || !G.titles) return;
  if (G.rep.battlesWon >= 10 && !G.titles.includes('Veteran')) {
    G.titles.push('Veteran');
    notify('Title earned: Veteran!');
  }
  if (G.rep.battlesWon >= 50 && !G.titles.includes('Champion')) {
    G.titles.push('Champion');
    notify('Title earned: Champion!');
  }
  // Wave 4 titles
  if ((G.essences?.length || 0) >= 10 && !G.titles.includes('Collector')) {
    G.titles.push('Collector');
    notify('Title earned: Collector! (10+ essences)');
  }
  if ((G.rep.craftsCompleted || 0) >= 3 && !G.titles.includes('Crafter')) {
    G.titles.push('Crafter');
    notify('Title earned: Crafter! (3+ crafts)');
  }
  if ((G.regionsVisited?.length || 0) >= 4 && !G.titles.includes('Explorer')) {
    G.titles.push('Explorer');
    notify('Title earned: Explorer! (all 4 regions)');
  }
  if ((G.team?.length || 0) >= 4 && !G.titles.includes('Team Builder')) {
    G.titles.push('Team Builder');
    notify('Title earned: Team Builder! (4+ team members)');
  }
  if ((G.loreCollected?.length || 0) >= 4 && !G.titles.includes('Lore Hunter')) {
    G.titles.push('Lore Hunter');
    notify('Title earned: Lore Hunter! (all lore tablets)');
  }
  if ((G.arenaWins || 0) >= 1 && !G.titles.includes('Arena Victor')) {
    G.titles.push('Arena Victor');
    notify('Title earned: Arena Victor!');
  }
}

// ── Spirit Comms (dialogue display) ──
function showComm(name, text, opts) {
  console.log(`[Comms] ${name}: ${text}`);
  if (_notifyCallback) _notifyCallback(`${name}: ${text}`);
}

// ── Save/Load (localStorage for now, Firebase later) ──
function saveGame() {
  try {
    const saveData = { playerData: G, timestamp: Date.now(), version: '1.0.0-phaser' };
    localStorage.setItem('boo_phaser_save', JSON.stringify(saveData));
    console.log('[Save] Game saved');
  } catch (e) {
    console.warn('[Save] Failed:', e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('boo_phaser_save');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.playerData) {
      Object.assign(G, data.playerData);
      console.log('[Load] Game loaded');
      return true;
    }
  } catch (e) {
    console.warn('[Load] Failed:', e);
  }
  return false;
}

// ── Extended G defaults (ensure all fields exist) ──
function ensurePlayerDefaults() {
  if (!G.team) G.team = [];
  if (!G.rep) G.rep = { battlesWon: 0, craftsCompleted: 0, itemsSold: 0, essencesCollected: 0, raresFound: 0 };
  if (!G.titles) G.titles = [];
  if (!G.essences) G.essences = [];
  if (!G.gear) G.gear = [];
  if (!G.equipped) G.equipped = { weapon: null, head: null, accessory: null };
  if (!G.mastery) G.mastery = { weapon: { xp: 0 }, armor: { xp: 0 }, accessory: { xp: 0 } };
  if (!G.quests) G.quests = { active: [], completed: [] };
  if (!G.loreCollected) G.loreCollected = [];
  if (!G.hostileNPCsDefeated) G.hostileNPCsDefeated = {};
  if (!G.unlockedSkills) G.unlockedSkills = [];
  if (G.level === undefined) G.level = 1;
  if (G.xp === undefined) G.xp = 0;
  if (G.coins === undefined) G.coins = 100;
  if (G.activeIdx === undefined) G.activeIdx = 0;
  G.inBattle = false; // never restore mid-battle state from save
  G.inDungeon = false; // never restore mid-dungeon state from save
  if (!G.currentZone) G.currentZone = 'frost_valley'; // zone tracking
  if (G.frostDungeonCleared === undefined) G.frostDungeonCleared = false; // intro/post cinematics auto-skip once true
  if (!G.materials) G.materials = {};
  if (!G.professionXP) G.professionXP = { combat: 0, exploration: 0, crafting: 0, trade: 0, charisma: 0 };
  if (!G.talentXPSpent) G.talentXPSpent = { combat: 0, exploration: 0, crafting: 0, trade: 0, charisma: 0 };
  if (!G.professionSkills) G.professionSkills = {};
  if (G.skillPointsUsed === undefined) G.skillPointsUsed = 0;
  if (!G.achievements) G.achievements = [];
  if (!G.discipline) G.discipline = null; // Fighter, Scout, Artisan, Merchant — chosen at game start
  // Resources (must exist for wisp collection + battle resource bar)
  if (G.iceShards === undefined) G.iceShards = 0;
  if (G.sacredFire === undefined) G.sacredFire = 0;
  if (G.healingSeeds === undefined) G.healingSeeds = 0;
  if (G.luckyStones === undefined) G.luckyStones = 0;
  if (G.surge === undefined) G.surge = 0;
  if (G.moonstone === undefined) G.moonstone = 0;
  if (G.firefly === undefined) G.firefly = 0;
  // Wave 3: combat mastery (derived from battlesWon)
  if (!G.mastery.combat) G.mastery.combat = { xp: 0 };
  // Wave 4: region visit tracking + arena wins
  if (!G.regionsVisited) G.regionsVisited = [];
  if (G.arenaWins === undefined) G.arenaWins = 0;
  // Wave 5: world bosses defeated + daily challenge
  if (G.worldBossesDefeated === undefined) G.worldBossesDefeated = 0;
  if (!G.dailyChallenge) G.dailyChallenge = null;
  // Wave 6: onboarding + multiplayer
  if (!G.spriteKey) G.spriteKey = 'player';
  if (!G.playerId) G.playerId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  if (G.tutorialStep === undefined) G.tutorialStep = 0;
  if (G.tutorialComplete === undefined) G.tutorialComplete = false;
  // Multiplayer buffs & party
  if (!G.activeBuffs) G.activeBuffs = [];
  if (!G.party) G.party = [];
  // Wave 7: talent trees
  if (!G.talents) G.talents = {};
  // All base class apprentices start unlocked (player can unlearn to reclaim points)
  if (!G.talents.fortune_teller) G.talents.fortune_teller = {};
  if (!G.talents.fortune_teller._app) G.talents.fortune_teller._app = 1;
  if (!G.talents.artisan) G.talents.artisan = {};
  if (!G.talents.artisan._app) G.talents.artisan._app = 1;
  if (!G.talents.trainer) G.talents.trainer = {};
  if (!G.talents.trainer._app) G.talents.trainer._app = 1;
  if (!G.talents.scientist) G.talents.scientist = {};
  if (!G.talents.scientist._app) G.talents.scientist._app = 1;
  if (!G.talents.cultivator) G.talents.cultivator = {};
  if (!G.talents.cultivator._app) G.talents.cultivator._app = 1;
  if (G.darkRiderUnlocked === undefined) G.darkRiderUnlocked = false;
  if (G.elderUnlocked === undefined) G.elderUnlocked = false;
  if (G.activeAmendment === undefined) G.activeAmendment = null; // Elder Council amendment id
  // Wave 8: Willpower progression — collection + deck config
  if (!G.willpowerCollection) G.willpowerCollection = []; // earned card IDs from drops
  if (!G.wpDeckConfig) {
    G.wpDeckConfig = typeof getHeartDeckConfig === 'function' ? getHeartDeckConfig() : { 0: 15 };
  }
}

// ── Profession mastery levels (based on profession XP thresholds) ──
const PROFESSION_MASTERY_LEVELS = [
  { name: 'Novice',       min: 0,    cls: 'novice' },
  { name: 'Apprentice',   min: 100,  cls: 'apprentice' },
  { name: 'Journeyman',   min: 350,  cls: 'journeyman' },
  { name: 'Expert',       min: 800,  cls: 'expert' },
  { name: 'Master',       min: 1600, cls: 'master' },
  { name: 'Grand Master', min: 3000, cls: 'grandmaster' },
];

function getProfessionMasteryInfo(xp) {
  let result = PROFESSION_MASTERY_LEVELS[0];
  for (const lvl of PROFESSION_MASTERY_LEVELS) {
    if (xp >= lvl.min) result = lvl;
  }
  return result;
}

// ── Discipline definitions (chosen at game start, bonuses referenced by other systems) ──
const PLAYER_DISCIPLINES = {
  fighter:  { name: 'Fighter',  icon: '\u2694\uFE0F', desc: '+10% combat XP gain', color: '#ff6644' },
  scout:    { name: 'Scout',    icon: '\uD83E\uDDED', desc: '+10% exploration XP, +20% recruit chance', color: '#44bbff' },
  artisan:  { name: 'Artisan',  icon: '\uD83D\uDD28', desc: '+10% crafting XP, +1 assembly roll bonus', color: '#ffaa22' },
  merchant: { name: 'Merchant', icon: '\uD83D\uDCB0', desc: 'Start with +50 gold, +10% trade XP', color: '#44dd44' },
};

// ═══════════════════════════════════════════════════
// PORTED FUNCTIONS FROM 2D index.html
// ═══════════════════════════════════════════════════

// ── Zone quality cycle (12-hour rotation) ──
function getZoneCycleId() {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 12));
}

function seededHash(a, b) {
  let h = ((a * 2654435761) ^ (b * 2246822519)) >>> 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h >>> 0) / 0xFFFFFFFF; // 0-1
}

function getZoneQuality(zoneIndex, cycleId) {
  const raw = seededHash(zoneIndex * 7919, cycleId * 104729);
  return 0.5 + raw * 1.0; // Map to 0.5 - 1.5
}

function getZoneQualityLabel(multiplier) {
  if (multiplier >= 1.2) return 'High Quality';
  if (multiplier >= 0.8) return 'Average';
  return 'Low';
}

function getZoneQualityClass(multiplier) {
  if (multiplier >= 1.2) return 'high';
  if (multiplier >= 0.8) return 'average';
  return 'low';
}

// ── Mastery system ──
const MASTERY_LEVELS = [
  { name: 'Novice', min: 0, cls: 'novice' },
  { name: 'Apprentice', min: 3, cls: 'apprentice' },
  { name: 'Journeyman', min: 6, cls: 'journeyman' },
  { name: 'Expert', min: 10, cls: 'expert' },
  { name: 'Master', min: 15, cls: 'master' },
];

function getMasteryInfo(xp) {
  let result = MASTERY_LEVELS[0];
  for (const lvl of MASTERY_LEVELS) {
    if (xp >= lvl.min) result = lvl;
  }
  return result;
}

function getMasteryLevel(xp) {
  if (xp >= 15) return 5;
  if (xp >= 10) return 4;
  if (xp >= 6) return 3;
  if (xp >= 3) return 2;
  return 1;
}

// ── Onboarding stub (no-op in Phaser) ──
function advanceOnboarding(step) {
  // No-op — onboarding is handled by Phaser scenes
}

// ── Craft reveal stub (no-op — Phaser CraftScene handles this) ──
function showCraftReveal(itemName, qualLabel, qualColor, crafterName) {
  console.log(`[CraftReveal] ${itemName} — ${qualLabel}`);
}

// ── HUD update stub (Phaser WorldScene handles HUD rendering) ──
function updateHUD() {
  console.log('[Stub] updateHUD — Phaser scene handles this');
}

// ── Show inventory stub ──
function showInventory() {
  console.log('[Stub] showInventory — Phaser scene handles this');
}

// ── Show team lineup stub ──
function showTeamLineup() {
  console.log('[Stub] showTeamLineup — Phaser scene handles this');
}

// ── Firebase / DB stubs (only if real Firebase SDK not loaded) ──
if (typeof firebase === 'undefined' || !firebase.database) {
  var firebase = { database: { ServerValue: { TIMESTAMP: Date.now() } } };
  var db = {
    _stub: true,
    ref: function(path) {
      return {
        set: function(val) { return Promise.resolve(); },
        push: function(val) { return Promise.resolve(); },
        once: function(eventType) { return Promise.resolve({ val: () => null }); },
        on: function(eventType, cb) { },
        off: function() {},
        remove: function() { return Promise.resolve(); },
        onDisconnect: function() { return { remove: function() { return Promise.resolve(); } }; },
        transaction: function(updateFn) {
          const result = updateFn(null);
          return Promise.resolve({ committed: !!result, snapshot: { val: () => result } });
        },
      };
    },
  };
} else {
  // Real Firebase loaded — db already set by index.html
  if (typeof db === 'undefined') var db = firebase.database();
}

// ── Multiplayer stubs (offline-first) ──
var otherPlayers = {};
var marketListings = {};
var housingData = {};
var showHomeOnMinimap = false;

// ── Wave 6: Multiplayer Presence (Firebase-ready, graceful offline) ──
// Session ID — unique per tab, NOT saved to localStorage
const _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const MultiplayerPresence = {
  _isStub: true,
  _listeners: {},
  _sessionKey: '',
  _currentRegion: null,       // region we're currently listening to
  _onPlayerUpdate: null,
  _onPlayerRemove: null,

  init() {
    this._sessionKey = (G.playerId || 'anon') + '_' + _sessionId;
    try {
      this._isStub = (db._stub === true);
    } catch(e) {
      this._isStub = true;
    }
    console.log('[MultiplayerPresence] init, stub:', this._isStub, 'session:', this._sessionKey);
  },

  // Write presence to region-based path: world/{region}/{sessionKey}
  updatePresence(playerData) {
    if (this._isStub || !this._sessionKey) return;
    const region = getCurrentRegion(G.x, G.y) || 'frost_valley';
    try {
      // If region changed, remove from old path
      if (this._currentRegion && this._currentRegion !== region) {
        db.ref('world/' + this._currentRegion + '/' + this._sessionKey).remove();
      }
      const activeGhost = G.team && G.team[G.activeIdx];
      db.ref('world/' + region + '/' + this._sessionKey).set({
        name: playerData.name || G.name,
        playerId: G.playerId,
        x: playerData.x || G.x,
        y: playerData.y || G.y,
        spriteKey: playerData.spriteKey || G.spriteKey,
        level: G.level || 1,
        activeName: activeGhost ? activeGhost.name : '',
        region: region,
        ts: firebase.database.ServerValue.TIMESTAMP,
      });
      // Switch listener if region changed
      if (this._currentRegion !== region) {
        this._switchRegionListener(region);
      }
    } catch(e) {
      console.warn('[MultiplayerPresence] updatePresence error:', e);
    }
  },

  // Listen to a specific region only — O(R) not O(N)
  startListening(onPlayerUpdate, onPlayerRemove) {
    this._onPlayerUpdate = onPlayerUpdate;
    this._onPlayerRemove = onPlayerRemove;
    if (this._isStub) return;
    const region = getCurrentRegion(G.x, G.y) || 'frost_valley';
    this._switchRegionListener(region);
  },

  // Reject entries older than this — onDisconnect cleanup fails for crashed
  // tabs / sleeping laptops, leaving stale presence rows in Firebase. They
  // re-render as semi-transparent "ghost" copies until purged.
  STALE_MS: 60000,

  _switchRegionListener(newRegion) {
    if (this._isStub) return;
    const self = this;

    // Unsubscribe from old region
    if (this._listeners.region) {
      try { this._listeners.region.off(); } catch(e) {}
      // Remove all sprites from old region
      if (this._onPlayerRemove && this._regionPlayers) {
        this._regionPlayers.forEach(pid => this._onPlayerRemove(pid));
      }
    }
    this._regionPlayers = new Set();
    this._currentRegion = newRegion;

    const handleSnap = (snap) => {
      const data = snap.val();
      const pid = snap.key || '';
      if (pid === self._sessionKey) return;
      // Stale-entry guard: skip rendering AND try to delete from Firebase
      // so other clients clean up too. Server clock skew of a few seconds
      // is fine — we only care about minutes-old entries.
      const ts = data && data.ts;
      if (typeof ts === 'number' && Date.now() - ts > self.STALE_MS) {
        try { db.ref('world/' + newRegion + '/' + pid).remove(); } catch(e) {}
        // Belt-and-suspenders: drop any local sprite for this pid too.
        if (self._regionPlayers.has(pid)) {
          self._regionPlayers.delete(pid);
          if (self._onPlayerRemove) self._onPlayerRemove(pid);
        }
        return;
      }
      self._regionPlayers.add(pid);
      if (data && self._onPlayerUpdate) self._onPlayerUpdate(pid, data);
    };

    // Subscribe to new region
    try {
      const ref = db.ref('world/' + newRegion);
      ref.on('child_added', handleSnap);
      ref.on('child_changed', handleSnap);
      ref.on('child_removed', snap => {
        const pid = snap.key || '';
        self._regionPlayers.delete(pid);
        if (self._onPlayerRemove) self._onPlayerRemove(pid);
      });
      this._listeners.region = ref;
      console.log('[MultiplayerPresence] listening to region:', newRegion);
    } catch(e) {
      console.warn('[MultiplayerPresence] listener error:', e);
    }
  },

  setupDisconnect() {
    if (this._isStub || !this._sessionKey) return;
    try {
      // Clean up from all regions on disconnect
      const regions = ['frost_valley', 'rolling_hills', 'volcanic_isles', 'dark_castle'];
      regions.forEach(r => {
        db.ref('world/' + r + '/' + this._sessionKey).onDisconnect().remove();
      });
    } catch(e) {}
  },

  stopListening() {
    if (this._listeners.region) {
      try { this._listeners.region.off(); } catch(e) {}
      this._listeners.region = null;
    }
  },
};

// ── Chat system (Firebase-backed, region-scoped) ──
const GameChat = {
  _messages: [],       // local message buffer
  _maxMessages: 50,
  _currentRegion: null,
  _listener: null,
  _onMessage: null,    // callback set by WorldScene

  init(onMessage) {
    this._onMessage = onMessage;
  },

  // Subscribe to a region's chat
  listenToRegion(region) {
    if (db._stub) return;
    if (this._currentRegion === region) return;

    // Unsubscribe from old region
    if (this._listener) {
      try { this._listener.off(); } catch(e) {}
    }
    this._messages = [];
    this._currentRegion = region;

    // Subscribe to new region — only last 20 messages
    try {
      this._listener = db.ref('chat/' + region).orderByChild('ts').limitToLast(20);
      this._listener.on('child_added', (snap) => {
        const msg = snap.val();
        if (!msg) return;
        this._messages.push(msg);
        if (this._messages.length > this._maxMessages) this._messages.shift();
        if (this._onMessage) this._onMessage(msg);
      });
    } catch(e) {
      console.warn('[GameChat] listen error:', e);
    }
  },

  // Send a message to current region
  send(text) {
    if (db._stub || !this._currentRegion || !text.trim()) return;
    const msg = {
      name: G.name || 'Unknown',
      text: text.trim().slice(0, 120), // max 120 chars
      level: G.level || 1,
      ts: firebase.database.ServerValue.TIMESTAMP,
    };
    try {
      db.ref('chat/' + this._currentRegion).push(msg);
    } catch(e) {
      console.warn('[GameChat] send error:', e);
    }
  },

  getMessages() { return this._messages; },
};

// Keep backwards compat — addChatMessage now sends to Firebase
function addChatMessage(sender, text) {
  GameChat.send(`[${sender}] ${text}`);
}

// ── Raid system (co-op boss fights via Firebase) ──
const RaidManager = {
  _raidId: null,
  _listener: null,
  _feedListener: null,
  _inviteListener: null,
  _isLeader: false,

  // Create a raid (called by party leader when engaging a boss)
  createRaid(bossId, bossName, bossHp, bossTeam) {
    if (db._stub) return null;
    const raidId = G.playerId + '_' + Date.now().toString(36);
    this._raidId = raidId;
    this._isLeader = true;

    const raidData = {
      bossId, bossName, bossMaxHp: bossHp, bossHp: bossHp,
      leaderId: G.playerId, leaderName: G.name,
      phase: 'active',
      startedAt: firebase.database.ServerValue.TIMESTAMP,
      expiresAt: Date.now() + 600000, // 10 min
      participants: {},
    };
    raidData.participants[G.playerId] = {
      name: G.name, level: G.level, totalDamage: 0, alive: true,
    };

    db.ref('raids/' + raidId).set(raidData);

    // Notify party members
    if (G.party && G.party.length > 0) {
      G.party.forEach(member => {
        db.ref('raid_invites/' + member.id).set({
          raidId, bossName, bossHp,
          from: G.name, leaderId: G.playerId,
          bossTeamIds: bossTeam.map(g => g.id),
        });
      });
    }

    // Listen for raid state changes
    this.listenToRaid(raidId);
    return raidId;
  },

  // Listen for raid state (boss HP, participants, completion)
  listenToRaid(raidId) {
    if (db._stub) return;
    this._raidId = raidId;

    if (this._listener) try { this._listener.off(); } catch(e) {}
    this._listener = db.ref('raids/' + raidId);

    this._listener.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;
      RaidManager._raidState = data;

      // Boss defeated check
      if (data.bossHp <= 0 && data.phase !== 'completed') {
        db.ref('raids/' + raidId + '/phase').set('completed');
      }
    });

    // Listen to dice feed
    if (this._feedListener) try { this._feedListener.off(); } catch(e) {}
    this._feedListener = db.ref('raids/' + raidId + '/feed').orderByChild('ts').limitToLast(10);
    this._feedListener.on('child_added', (snap) => {
      const entry = snap.val();
      if (!entry || entry.playerId === G.playerId) return;
      // Dispatch to BattleScene if active
      if (RaidManager._onFeedEntry) RaidManager._onFeedEntry(entry);
    });
  },

  // Report damage dealt after a round
  reportDamage(damage, playerName, diceResult) {
    if (db._stub || !this._raidId) return;
    const raidId = this._raidId;

    // Decrement boss HP atomically
    db.ref('raids/' + raidId + '/bossHp').transaction((hp) => {
      if (hp === null) return 0;
      return Math.max(0, hp - damage);
    });

    // Update participant damage total
    db.ref('raids/' + raidId + '/participants/' + G.playerId + '/totalDamage')
      .transaction((d) => (d || 0) + damage);

    // Post to feed
    db.ref('raids/' + raidId + '/feed').push({
      playerId: G.playerId,
      name: playerName || G.name,
      damage,
      dice: diceResult || [],
      ts: firebase.database.ServerValue.TIMESTAMP,
    });
  },

  // Listen for incoming raid invites (called once at startup)
  listenForInvites(onInvite) {
    if (db._stub || !G.playerId) return;
    if (this._inviteListener) return;

    this._inviteListener = db.ref('raid_invites/' + G.playerId);
    this._inviteListener.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;
      snap.ref.remove(); // consume the invite
      if (onInvite) onInvite(data);
    });
  },

  // Get current raid boss HP (for BattleScene to read)
  getRaidBossHp() {
    return this._raidState ? this._raidState.bossHp : null;
  },

  getParticipants() {
    return this._raidState?.participants || {};
  },

  // Clean up listeners
  leaveRaid() {
    if (this._listener) try { this._listener.off(); } catch(e) {}
    if (this._feedListener) try { this._feedListener.off(); } catch(e) {}
    this._raidId = null;
    this._raidState = null;
    this._isLeader = false;
    this._onFeedEntry = null;
  },

  _raidState: null,
  _onFeedEntry: null,
};

// ── Housing data ──
var HOUSE_PLOTS = [
  { id: 'frost_1', name: 'Polaris Cottage', x: 12, y: 18, region: 'Frost Valley' },
  { id: 'frost_2', name: 'Lakeside Cabin', x: 38, y: 18, region: 'Frost Valley' },
  { id: 'hills_1', name: 'Meadowbrook House', x: 22, y: 55, region: 'Rolling Hills' },
  { id: 'hills_2', name: 'Hilltop Villa', x: 38, y: 60, region: 'Rolling Hills' },
  { id: 'volcanic_1', name: 'Beach Bungalow', x: 72, y: 55, region: 'Volcanic Isles' },
  { id: 'volcanic_2', name: 'Island Retreat', x: 78, y: 15, region: 'Volcanic Isles' },
  { id: 'volcanic_3', name: 'Lagoon Hut', x: 64, y: 48, region: 'Volcanic Isles' },
];

var TROPHY_DEFS = {
  boss_slayer: { name: 'Boss Slayer', icon: '\u2694\uFE0F', desc: 'Defeated a world boss' },
  mastercraft_weapon: { name: 'Master Weaponsmith', icon: '\u2692\uFE0F', desc: 'Mastered weapon crafting' },
  mastercraft_armor: { name: 'Master Armorer', icon: '\uD83D\uDEE1\uFE0F', desc: 'Mastered armor crafting' },
  master_combat: { name: 'War Hero', icon: '\uD83C\uDF96\uFE0F', desc: 'Combat XP milestone' },
  master_exploration: { name: 'World Explorer', icon: '\uD83C\uDF0D', desc: 'Exploration XP milestone' },
  collector_rare: { name: 'Rare Collector', icon: '\uD83D\uDC8E', desc: 'Found 10+ rare Spiritkin' },
  arena_champion: { name: 'Arena Champion', icon: '\uD83C\uDFC6', desc: 'Won 20 arena battles' },
  lore_frost: { name: 'Frost Scholar', icon: '\u2744\uFE0F', desc: 'All Frost Valley lore collected' },
  lore_hills: { name: 'Meadow Scholar', icon: '\uD83C\uDF3F', desc: 'All Rolling Hills lore collected' },
  lore_volcanic: { name: 'Volcanic Scholar', icon: '\uD83C\uDF0B', desc: 'All Volcanic lore collected' },
};

// ── Guild craft bonus stub ──
function getGuildCraftBonus() { return 0; }

// ── isInParty stub ──
function isInParty() { return false; }
