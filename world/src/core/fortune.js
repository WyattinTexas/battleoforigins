// ══════════════════════════════════════════════════════════
//  FORTUNE TELLER SYSTEM
//  Apprentice unlock → Give Fortune ability (50/50 Good/Bad)
//  Good Fortune: +1 Lucky Stone in next battle
//  Bad Fortune: -1 die on first roll in next battle
//  Giving fortunes to players earns Fortune XP (NPCs = 1/10th)
//  Fortune XP unlocks talents in the 3 branches:
//    Duration (left) — how long / when fortunes apply
//    Power (center) — what the fortune actually does
//    Resonance (right) — XP gain, multi-target, range
// ══════════════════════════════════════════════════════════

// ── Fortune state on G ─────────────────────────────────
// G.fortuneXP        — total Fortune XP earned
// G.fortuneCooldown   — timestamp of last fortune given (30s cooldown)
// G.activeFortune     — { type: 'good'|'bad', source: 'name' } or null
// G.fortuneBadDice    — battle-local: -1 dice on first roll flag

function ensureFortuneDefaults() {
  if (G.fortuneXP === undefined) G.fortuneXP = 0;
  if (G.fortuneCooldown === undefined) G.fortuneCooldown = 0;
  if (!G.activeFortune) G.activeFortune = null;
}

// ── Can the player give fortunes? ──────────────────────
function canGiveFortune() {
  return isApprentice('fortune_teller');
}

// ── Is the fortune ability off cooldown? ───────────────
function isFortuneReady() {
  if (!canGiveFortune()) return false;
  return Date.now() - (G.fortuneCooldown || 0) >= 30000;
}

function getFortuneCooldownSec() {
  const remaining = 30000 - (Date.now() - (G.fortuneCooldown || 0));
  return Math.max(0, Math.ceil(remaining / 1000));
}

// ── Give a fortune to a target ─────────────────────────
// isPlayer: true = real player (full XP), false = NPC (1/10th XP)
// Returns { type, name, desc } or null if on cooldown
function giveFortune(targetName, isPlayer) {
  if (!isFortuneReady()) return null;

  // 50/50 good or bad
  const isGood = Math.random() < 0.5;
  const fortune = isGood
    ? { type: 'good', name: 'Good Fortune', desc: '+1 Lucky Stone in next battle' }
    : { type: 'bad', name: 'Bad Fortune', desc: '-1 die on first roll in next battle' };

  // Apply fortune to the target
  // For NPCs / solo testing: apply to self as demo
  // For real multiplayer: would send to target player via Firebase
  G.activeFortune = { type: fortune.type, source: G.name || 'Fortune Teller' };

  // Cooldown
  G.fortuneCooldown = Date.now();

  // Earn Fortune XP: 10 for players, 1 for NPCs
  const xpGain = isPlayer ? 10 : 1;
  G.fortuneXP = (G.fortuneXP || 0) + xpGain;

  // Also charisma profession XP
  if (typeof addProfessionXP === 'function') {
    addProfessionXP('charisma', isPlayer ? 5 : 1);
  }

  if (typeof saveGame === 'function') saveGame();
  return fortune;
}

// ── Apply fortune effects when battle starts ───────────
// Call this at the start of BattleScene.create() or battle init
function applyFortuneToBattle() {
  if (!G.activeFortune) return;

  const fortune = G.activeFortune;

  if (fortune.type === 'good') {
    // +1 Lucky Stone for this battle
    G.luckyStones = Math.min(5, (G.luckyStones || 0) + 1);
  }

  if (fortune.type === 'bad') {
    // Flag for BattleScene: subtract 1 die from first roll
    // Store on G temporarily — BattleScene reads it and clears it after first roll
    G._fortuneBadDice = true;
  }

  // Fortune consumed
  G.activeFortune = null;
  if (typeof saveGame === 'function') saveGame();
}

// ── Check & consume bad dice flag (call during first roll) ─
// Returns -1 if bad fortune active, 0 otherwise. Clears the flag.
function consumeFortuneBadDice() {
  if (G._fortuneBadDice) {
    G._fortuneBadDice = false;
    return -1;
  }
  return 0;
}

// ── Fortune XP thresholds ──────────────────────────────
// Each talent auto-unlocks when Fortune XP reaches the threshold
// Duration (left): how long fortunes last / persist
// Power (center): what the fortune does (stronger effects)
// Resonance (right): XP gain rate, multi-target, passive aura
const FORTUNE_XP_THRESHOLDS = {
  // Tier 0 — unlock at 50 XP (5 player fortunes or 50 NPC fortunes)
  'ft_dur_1': 50,
  'ft_pow_1': 50,
  'ft_res_1': 50,
  // Tier 1 — 200 XP
  'ft_dur_2': 200,
  'ft_pow_2': 200,
  'ft_res_2': 200,
  // Tier 2 — 500 XP
  'ft_dur_3': 500,
  'ft_pow_3': 500,
  'ft_res_3': 500,
  // Tier 3 — 1000 XP
  'ft_dur_4': 1000,
  'ft_pow_4': 1000,
  'ft_res_4': 1000,
};

// Check if any new talents should auto-unlock based on Fortune XP
function checkFortuneUnlocks() {
  if (!G.talents || !G.talents.fortune_teller) return;
  if (!isApprentice('fortune_teller')) return;

  const xp = G.fortuneXP || 0;
  let changed = false;

  for (const talentId in FORTUNE_XP_THRESHOLDS) {
    const threshold = FORTUNE_XP_THRESHOLDS[talentId];
    const currentRank = getTalentRank('fortune_teller', talentId);
    const talent = _findTalent('fortune_teller', talentId);
    if (!talent) continue;

    // Auto-unlock: if XP >= threshold and not yet at max rank
    if (xp >= threshold && currentRank < talent.maxRank) {
      if (!G.talents.fortune_teller) G.talents.fortune_teller = {};
      G.talents.fortune_teller[talentId] = talent.maxRank;
      changed = true;
    }
  }

  if (changed && typeof saveGame === 'function') saveGame();
  return changed;
}
