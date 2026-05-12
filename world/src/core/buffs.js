// ══════════════════════════════════════════════════════════
//  BUFF/EFFECT ENGINE
//  Unified system for all timed player effects:
//  Fortunes, meditation, preparation, garden buffs, elder barrier, sparks
//  G.buffs = [{ id, name, source, effects, expiresAt, icon, color }]
// ══════════════════════════════════════════════════════════

function ensureBuffDefaults() {
  if (!G.buffs) G.buffs = [];
}

// ── Add a buff ─────────────────────────────────────────
// effects: { luckyStones, bonusDamage, diceMod, healHP, speedMod, xpMod, dmgReduction }
// durationMs: 0 = consumed on next battle, >0 = time-based
// Returns the buff object or null if already has non-stackable version
function addBuff(opts) {
  if (!G.buffs) G.buffs = [];

  // Check if player already has this buff (no stacking by default)
  if (!opts.stackable) {
    const existing = G.buffs.find(b => b.id === opts.id);
    if (existing) return null;
  }

  const buff = {
    id: opts.id,
    name: opts.name || opts.id,
    source: opts.source || 'Unknown',
    effects: opts.effects || {},
    expiresAt: opts.durationMs > 0 ? Date.now() + opts.durationMs : 0,
    consumeOnBattle: opts.durationMs === 0,
    icon: opts.icon || '★',
    color: opts.color || '#88ff88',
    persistThroughKO: opts.persistThroughKO || false,
  };

  G.buffs.push(buff);
  if (typeof saveGame === 'function') saveGame();
  return buff;
}

// ── Remove a buff by ID ────────────────────────────────
function removeBuff(buffId) {
  if (!G.buffs) return;
  G.buffs = G.buffs.filter(b => b.id !== buffId);
  if (typeof saveGame === 'function') saveGame();
}

// ── Remove all expired buffs ───────────────────────────
function tickBuffs() {
  if (!G.buffs || G.buffs.length === 0) return;
  const now = Date.now();
  const before = G.buffs.length;
  G.buffs = G.buffs.filter(b => {
    if (b.expiresAt > 0 && now > b.expiresAt) return false;
    return true;
  });
  if (G.buffs.length !== before && typeof saveGame === 'function') saveGame();
}

// ── Check if player has a specific buff ────────────────
function hasBuff(buffId) {
  tickBuffs();
  return G.buffs && G.buffs.some(b => b.id === buffId);
}

// ── Get a specific buff ────────────────────────────────
function getBuff(buffId) {
  tickBuffs();
  return G.buffs ? G.buffs.find(b => b.id === buffId) : null;
}

// ── Get all active buffs ───────────────────────────────
function getActiveBuffs() {
  tickBuffs();
  return G.buffs || [];
}

// ── Get combined effects from all active buffs ─────────
// Returns summed effect values across all buffs
function getCombinedBuffEffects() {
  tickBuffs();
  const combined = {
    luckyStones: 0,
    bonusDamage: 0,
    diceMod: 0,
    healHP: 0,
    speedMod: 0,
    xpMod: 0,
    dmgReduction: 0,
  };
  for (const buff of (G.buffs || [])) {
    const e = buff.effects || {};
    if (e.luckyStones) combined.luckyStones += e.luckyStones;
    if (e.bonusDamage) combined.bonusDamage += e.bonusDamage;
    if (e.diceMod) combined.diceMod += e.diceMod;
    if (e.healHP) combined.healHP += e.healHP;
    if (e.speedMod) combined.speedMod += e.speedMod;
    if (e.xpMod) combined.xpMod += e.xpMod;
    if (e.dmgReduction) combined.dmgReduction += e.dmgReduction;
  }
  return combined;
}

// ── Apply all buff effects at battle start ─────────────
// Call this once when BattleScene creates
function applyBuffsToBattle() {
  tickBuffs();
  const effects = getCombinedBuffEffects();

  // Lucky Stones
  if (effects.luckyStones > 0) {
    G.luckyStones = Math.min(5, (G.luckyStones || 0) + effects.luckyStones);
  }

  // Heal active spiritkin
  if (effects.healHP > 0 && G.team && G.team[G.activeIdx]) {
    const spirit = G.team[G.activeIdx];
    spirit.hp = Math.min(spirit.maxHp || spirit.hp, spirit.hp + effects.healHP);
  }

  // Store dice mod and damage bonus for BattleScene to read
  G._buffDiceMod = effects.diceMod || 0;
  G._buffBonusDamage = effects.bonusDamage || 0;
  G._buffDmgReduction = effects.dmgReduction || 0;

  // Consume single-battle buffs
  if (G.buffs) {
    G.buffs = G.buffs.filter(b => !b.consumeOnBattle);
  }

  if (typeof saveGame === 'function') saveGame();
}

// ── Consume dice mod (call during first roll) ──────────
function consumeBuffDiceMod() {
  const mod = G._buffDiceMod || 0;
  G._buffDiceMod = 0;
  return mod;
}

// ── Consume bonus damage ───────────────────────────────
function consumeBuffBonusDamage() {
  const dmg = G._buffBonusDamage || 0;
  G._buffBonusDamage = 0;
  return dmg;
}

// ── Get remaining seconds on a buff ────────────────────
function getBuffTimeRemaining(buffId) {
  const buff = getBuff(buffId);
  if (!buff) return 0;
  if (buff.expiresAt === 0) return -1; // consumed on battle
  return Math.max(0, Math.ceil((buff.expiresAt - Date.now()) / 1000));
}

// ══════════════════════════════════════════════════════════
//  CONVENIENCE: Create specific buff types
// ══════════════════════════════════════════════════════════

// Fortune Teller: Good Fortune
function addGoodFortuneBuff(luckyStones, healHP, bonusDamage, speedMod, durationMs) {
  return addBuff({
    id: 'good_fortune', name: 'Good Fortune', source: 'Fortune Teller',
    icon: '★', color: '#88ff44',
    effects: { luckyStones: luckyStones || 1, healHP: healHP || 0, bonusDamage: bonusDamage || 0, speedMod: speedMod || 0 },
    durationMs: durationMs || 0,
  });
}

// Fortune Teller: Bad Fortune
function addBadFortuneBuff(dicePenalty, durationMs) {
  return addBuff({
    id: 'bad_fortune', name: 'Bad Fortune', source: 'Fortune Teller',
    icon: '☆', color: '#ff6666',
    effects: { diceMod: -(dicePenalty || 1) },
    durationMs: durationMs || 0,
  });
}

// Shaman: Garden Communion (+1 die for duration)
function addMeditationBuff(durationMs) {
  return addBuff({
    id: 'meditation', name: 'Garden Communion', source: 'Shaman',
    icon: '◆', color: '#66cc88',
    effects: { diceMod: 1 },
    durationMs: durationMs || 600000, // default 10 min
  });
}

// Scholar: Preparation (+1 die first roll)
function addPreparationBuff(durationMs) {
  return addBuff({
    id: 'preparation', name: 'Preparation', source: 'Scholar',
    icon: '◇', color: '#8888ff',
    effects: { diceMod: 1 },
    durationMs: durationMs || 600000, // default 10 min
  });
}

// Cultivator: Garden's Gift (Healing Seed)
function addGardensGiftBuff() {
  return addBuff({
    id: 'gardens_gift', name: 'Garden\'s Gift', source: 'Cultivator',
    icon: '❋', color: '#66cc66',
    effects: { healHP: 0 }, // actually gives a Healing Seed resource
    durationMs: 120000, // 2 min
  });
}

// Enchanter: Essence Spark (XP buff)
function addEssenceSparkBuff(xpMod, durationMs) {
  return addBuff({
    id: 'essence_spark', name: 'Essence Spark', source: 'Enchanter',
    icon: '✦', color: '#44ddaa',
    effects: { xpMod: xpMod || 0.05 },
    durationMs: durationMs || 600000,
  });
}
