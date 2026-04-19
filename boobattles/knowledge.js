// ══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — Boss data, locations, lore, tournament structure
// ══════════════════════════════════════════════════════════════════════════════

const BOSS_NAMES = ['Logey','Bogey','Guard Thomas','Stone Cold','Pelter','Antoinette','King Jay','Hector','Prince Balatron','Lucy','Romy','The Mountain King'];
const BOSS_HP =    [6, 5, 6, 7, 5, 6, 7, 6, 6, 8, 8, 9];
const BOSS_DROPS = ['reroll','heal','reroll','power','heal','reroll','power','heal','power','reroll','heal',null];

// Themed location names for each boss fight
let BOSS_LOCATIONS = [
  'Castle Depths',              // Logey
  'Hot Hot Cavern',             // Bogey
  'Jeffery Manor',              // Guard Thomas
  'Training Grounds',           // Stone Cold
  'Frost Valley',               // Pelter
  'The Crystal Ballroom',       // Antoinette
  'Ice Palace',                 // King Jay
  'The Great Stairway',         // Hector
  'Preliminary Round',          // Balatron
  'Quarter Finals',             // Lucy
  'Semi Finals',                // Romy
  'Championship Match'          // Mountain King
];

const LOCATION_THEMES = {
  'Castle Depths': { bg: 'linear-gradient(180deg, #0a0a2a, #1a0a2a, #0a0a1a)', accent: '#8b5cf6' },
  'Hot Hot Cavern': { bg: 'linear-gradient(180deg, #1a0500, #2a0a00, #0a0500)', accent: '#f97316' },
  'Jeffery Manor': { bg: 'linear-gradient(180deg, #0a1a0a, #1a2a1a, #0a0a0a)', accent: '#4ade80' },
  'Training Grounds': { bg: 'linear-gradient(180deg, #1a1a0a, #2a2a0a, #0a0a00)', accent: '#eab308' },
  'Frost Valley': { bg: 'linear-gradient(180deg, #001020, #002040, #001020)', accent: '#38bdf8' },
  'The Crystal Ballroom': { bg: 'linear-gradient(180deg, #1a0520, #200a1a, #0a0510)', accent: '#ec4899' },
  'Ice Palace': { bg: 'linear-gradient(180deg, #000a1a, #001a2a, #000a1a)', accent: '#3b82f6' },
  'The Great Stairway': { bg: 'linear-gradient(180deg, #0a0a0a, #1a1a1a, #0a0a0a)', accent: '#f8fafc' },
  'Preliminary Round': { bg: 'linear-gradient(180deg, #1a0a0a, #2a0a0a, #0a0000)', accent: '#ef4444' },
  'Quarter Finals': { bg: 'linear-gradient(180deg, #0a0a1a, #1a0a2a, #0a001a)', accent: '#a78bfa' },
  'Semi Finals': { bg: 'linear-gradient(180deg, #0a1a1a, #0a2a2a, #001a1a)', accent: '#2dd4bf' },
  'Championship Match': { bg: 'linear-gradient(180deg, #1a1000, #2a1a00, #0a0800)', accent: '#f59e0b' },
  'The Dark Summit': { bg: 'linear-gradient(180deg, #0a0a0a, #1a1a1a, #0a0a0a)', accent: '#f8fafc' },
  'The Shadow Realm': { bg: 'linear-gradient(180deg, #0a0a1a, #1a0a2a, #0a001a)', accent: '#a78bfa' },
  'The Throne Room': { bg: 'linear-gradient(180deg, #1a1000, #2a1a00, #0a0800)', accent: '#f59e0b' },
  'The Abyss': { bg: 'linear-gradient(180deg, #050005, #100010, #050005)', accent: '#ef4444' },
  '???': { bg: 'linear-gradient(180deg, #0a0a1a, #1a1a2a, #0a0a1a)', accent: '#67e8f9' },
};

// Fixed starters — always these 3
const STARTER_NAMES = ['Dream Cat', 'Outlaw', 'Wim'];

// Replay final 4 bosses
const REPLAY_FINAL4 = ['The Mountain King', 'Shade', 'Prince Balatron', 'Doom'];
const REPLAY_FINAL4_LOCATIONS = ['The Dark Summit', 'The Shadow Realm', 'The Throne Room', 'The Abyss'];

let BOSSES = buildBosses(false);

function buildBosses(isReplay) {
  if (!isReplay) {
    return BOSS_NAMES.map((name, i) => {
      const base = ALL_GHOSTS.find(g => g.name === name);
      return { ...base, bossHp: BOSS_HP[i], maxHp: BOSS_HP[i], hp: BOSS_HP[i], drop: BOSS_DROPS[i], bossIndex: i };
    });
  }
  // Replay: random non-legendary ghosts for first 8, then special final 4
  const nonLeg = ALL_GHOSTS.filter(g => g.rarity !== 'legendary');
  const shuffled = [...nonLeg].sort(() => Math.random() - 0.5);
  const first8 = shuffled.slice(0, 8).map((g, i) => ({
    ...g, bossHp: g.maxHp, maxHp: g.maxHp, hp: g.maxHp, drop: BOSS_DROPS[i], bossIndex: i
  }));
  const final4 = REPLAY_FINAL4.map((name, i) => {
    const base = ALL_GHOSTS.find(g => g.name === name);
    const idx = 8 + i;
    return { ...base, bossHp: base.maxHp, maxHp: base.maxHp, hp: base.maxHp, drop: BOSS_DROPS[idx] || null, bossIndex: idx };
  });
  return [...first8, ...final4];
}
