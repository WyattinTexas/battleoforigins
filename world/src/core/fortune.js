// ══════════════════════════════════════════════════════════
//  FORTUNE TELLER SYSTEM
//  Apprentice unlock → [F] Give Fortune (50/50 Good/Bad base)
//  Good Fortune: +1 Lucky Stone | Bad Fortune: -1 die first roll
//  Can't fortune someone who already has a fortune
//  Players = 10 Fortune XP | NPCs = 1 Fortune XP
//  Talents auto-unlock as Fortune XP reaches thresholds
//  Dark Fortune branch (100 bad fortunes) → Dark Rider unlock
// ══════════════════════════════════════════════════════════

function ensureFortuneDefaults() {
  if (G.fortuneXP === undefined) G.fortuneXP = 0;
  if (G.fortuneCooldown === undefined) G.fortuneCooldown = 0;
  if (!G.activeFortune) G.activeFortune = null;
  if (G.badFortunesGiven === undefined) G.badFortunesGiven = 0;
  if (G.fortuneDuration === undefined) G.fortuneDuration = 0; // 0 = 1 battle, else ms timestamp when it expires
}

// ── Can the player give fortunes? ──────────────────────
function canGiveFortune() {
  return typeof isApprentice === 'function' && isApprentice('fortune_teller');
}

// ── Cooldown ───────────────────────────────────────────
function isFortuneReady() {
  if (!canGiveFortune()) return false;
  return Date.now() - (G.fortuneCooldown || 0) >= 5000;
}

function getFortuneCooldownSec() {
  const remaining = 5000 - (Date.now() - (G.fortuneCooldown || 0));
  return Math.max(0, Math.ceil(remaining / 1000));
}

// ── Calculate current Good/Bad odds ────────────────────
function getFortuneOdds() {
  let goodChance = 0.50; // base 50/50

  // Dark Fortune: Misfortune Mastery shifts to 35/65
  if (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_drk_2') >= 1) {
    goodChance = 0.35;
  }

  // Master Fortune Teller resets to 50/50
  if (typeof isMaster === 'function' && isMaster('fortune_teller')) {
    goodChance = 0.50;
  }

  return goodChance;
}

// ── Calculate fortune duration (ms) ────────────────────
function getFortuneDurationMs() {
  if (typeof getTalentRank !== 'function') return 0;
  // Tier 2: 1 hour (max)
  if (getTalentRank('fortune_teller', 'ft_bal_3') >= 1) return 60 * 60 * 1000;
  // Tier 1: 20 min
  if (getTalentRank('fortune_teller', 'ft_bal_2') >= 1) return 20 * 60 * 1000;
  // Tier 0: 5 min
  if (getTalentRank('fortune_teller', 'ft_bal_1') >= 1) return 5 * 60 * 1000;
  // Base: 0 = lasts 1 battle only (consumed on battle start)
  return 0;
}

// ── Does fortune persist through KO? ───────────────────
function fortunePersistsThroughKO() {
  return typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_bal_4') >= 1;
}

// ── Check if player already has an active fortune ──────
function hasActiveFortune() {
  if (!G.activeFortune) return false;
  // Check time-based expiry
  if (G.activeFortune.expiresAt && Date.now() > G.activeFortune.expiresAt) {
    G.activeFortune = null;
    return false;
  }
  return true;
}

// ── Give a fortune to a target ─────────────────────────
// isPlayer: true = real player (10 XP), false = NPC (1 XP)
// Returns { type, name, desc } or null
function giveFortune(targetName, isPlayer) {
  if (!isFortuneReady()) return null;

  // Can't fortune someone who already has a fortune
  // (For now this checks self since we apply to self as demo)
  if (hasActiveFortune()) return null;

  // Roll odds
  const goodChance = getFortuneOdds();
  const isGood = Math.random() < goodChance;

  // Build fortune result
  let fortune;
  if (isGood) {
    // How many lucky stones?
    const potent = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_brt_1') >= 1);
    const luckyStones = potent ? 2 : 1;

    // Blessed Touch: heal 3 HP?
    const blessedTouch = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_brt_2') >= 1);
    const healHP = blessedTouch ? 3 : 0;

    // Fortune's Favor: +5% walk speed?
    const favor = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_brt_3') >= 1);

    // Radiant Blessing: +1 damage on first roll?
    const radiant = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_brt_4') >= 1);

    // Master FT: +1 bonus damage + 5% speed
    const master = (typeof isMaster === 'function' && isMaster('fortune_teller'));

    let desc = '+' + luckyStones + ' Lucky Stone' + (luckyStones > 1 ? 's' : '');
    if (healHP > 0) desc += ', +' + healHP + ' HP';
    if (favor || master) desc += ', +5% speed';
    if (radiant) desc += ', +1 dmg first roll';
    if (master) desc += ', +1 bonus dmg';

    fortune = {
      type: 'good', name: 'Good Fortune', desc: desc,
      luckyStones: luckyStones, healHP: healHP,
      speedBoost: (favor || master), bonusDamage: (radiant || master) ? 1 : 0,
    };
  } else {
    // Bad fortune
    const cruel = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_drk_1') >= 1);
    const dicePenalty = cruel ? 2 : 1;

    let desc = '-' + dicePenalty + ' dice on first roll';

    // Hex: Dark Riders 20% more attracted
    const hex = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_drk_3') >= 1);
    if (hex) desc += ', Dark Riders attracted';

    fortune = {
      type: 'bad', name: 'Bad Fortune', desc: desc,
      dicePenalty: dicePenalty, hexActive: hex,
    };

    // Master FT has restored balance — bad fortunes no longer count toward Dark Rider
    const masterFT = (typeof isMaster === 'function' && isMaster('fortune_teller'));

    // Only track bad fortunes for Dark Rider if NOT a master
    if (!masterFT) {
      G.badFortunesGiven = (G.badFortunesGiven || 0) + 1;
    }

    // Dark Profit: gain 5 gold per bad fortune
    const darkProfit = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_drk_4') >= 1);
    if (darkProfit) {
      G.coins = (G.coins || 0) + 5;
      desc += ', +5 gold';
      fortune.desc = desc;
    }

    // Check Dark Rider unlock (100 bad fortunes with dark talents, before mastery)
    const hasDarkTalents = (typeof getTalentRank === 'function' && getTalentRank('fortune_teller', 'ft_drk_1') >= 1);
    if (!masterFT && hasDarkTalents && G.badFortunesGiven >= 100 && !G.darkRiderUnlocked) {
      G.darkRiderUnlocked = true;
      fortune.darkRiderUnlocked = true;
    }
  }

  // Calculate duration
  const durationMs = getFortuneDurationMs();

  // Apply fortune
  G.activeFortune = {
    type: fortune.type,
    source: G.name || 'Fortune Teller',
    data: fortune,
    expiresAt: durationMs > 0 ? Date.now() + durationMs : 0, // 0 = consumed on next battle
  };

  // Set cooldown
  G.fortuneCooldown = Date.now();

  // Earn Fortune XP
  const xpGain = isPlayer ? 10 : 1;
  G.fortuneXP = (G.fortuneXP || 0) + xpGain;

  // Charisma profession XP
  if (typeof addProfessionXP === 'function') {
    addProfessionXP('charisma', isPlayer ? 5 : 1);
  }

  // Check talent auto-unlocks
  if (typeof checkFortuneUnlocks === 'function') checkFortuneUnlocks();

  if (typeof saveGame === 'function') saveGame();
  return fortune;
}

// ── Apply fortune effects at battle start ──────────────
function applyFortuneToBattle() {
  if (!G.activeFortune) return;

  const fortune = G.activeFortune;
  const data = fortune.data || {};

  if (fortune.type === 'good') {
    // Lucky Stones
    const ls = data.luckyStones || 1;
    G.luckyStones = Math.min(5, (G.luckyStones || 0) + ls);

    // Heal HP
    if (data.healHP > 0 && G.team && G.team[G.activeIdx]) {
      const spirit = G.team[G.activeIdx];
      spirit.hp = Math.min(spirit.maxHp || spirit.hp, spirit.hp + data.healHP);
    }

    // Bonus damage flag for BattleScene
    if (data.bonusDamage > 0) {
      G._fortuneBonusDamage = data.bonusDamage;
    }
  }

  if (fortune.type === 'bad') {
    // Flag for dice reduction on first roll
    G._fortuneBadDice = data.dicePenalty || 1;
  }

  // Consume fortune if no duration (1-battle)
  if (!fortune.expiresAt || fortune.expiresAt === 0) {
    G.activeFortune = null;
  }
  // Time-based fortunes stay until they expire (checked by hasActiveFortune)

  if (typeof saveGame === 'function') saveGame();
}

// ── Consume bad dice flag (call during first roll only) ─
function consumeFortuneBadDice() {
  if (G._fortuneBadDice) {
    const penalty = G._fortuneBadDice;
    G._fortuneBadDice = 0;
    return -penalty; // negative = fewer dice
  }
  return 0;
}

// ── Consume bonus damage flag ──────────────────────────
function consumeFortuneBonusDamage() {
  if (G._fortuneBonusDamage) {
    const bonus = G._fortuneBonusDamage;
    G._fortuneBonusDamage = 0;
    return bonus;
  }
  return 0;
}

// ── Fortune XP thresholds for auto-unlock ──────────────
const FORTUNE_XP_THRESHOLDS = {
  // Bright Fortune
  'ft_brt_1': 50,   'ft_brt_2': 200,  'ft_brt_3': 500,  'ft_brt_4': 1000,
  // Fate's Balance
  'ft_bal_1': 50,    'ft_bal_2': 200,   'ft_bal_3': 500,   'ft_bal_4': 1000,
  // Dark Fortune
  'ft_drk_1': 50,   'ft_drk_2': 200,  'ft_drk_3': 500,  'ft_drk_4': 1000,
};

function checkFortuneUnlocks() {
  if (!isApprentice('fortune_teller')) return false;
  const xp = G.fortuneXP || 0;
  let changed = false;

  if (!G.talents) G.talents = {};
  if (!G.talents.fortune_teller) G.talents.fortune_teller = {};

  for (const talentId in FORTUNE_XP_THRESHOLDS) {
    const threshold = FORTUNE_XP_THRESHOLDS[talentId];
    if (xp >= threshold) {
      const current = G.talents.fortune_teller[talentId] || 0;
      if (current < 1) {
        G.talents.fortune_teller[talentId] = 1;
        changed = true;
      }
    }
  }

  if (changed && typeof saveGame === 'function') saveGame();
  return changed;
}
