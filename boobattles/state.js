// ══════════════════════════════════════════════════════════════════════════════
// STATE — Game state, battle variables, save/load persistence
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════
let state = null;

function newState(isRestart) {
  return {
    runActive: true,
    isRestart: isRestart || false,
    currentBoss: 0,
    collection: [],
    items: [],
    usedCards: BOSSES.map(b => b.name), // bosses excluded from draw pool
    deadGhosts: [],
    killedBy: {},
    battleWins: [],
    stats: { bossesBeaten: 0, ghostsLost: 0, totalRolls: 0, itemsUsed: 0 }
  };
}

function saveState() { localStorage.setItem('boo_nuzlocke_save', JSON.stringify(state)); }
function loadState() { try { return JSON.parse(localStorage.getItem('boo_nuzlocke_save')); } catch { return null; } }
function clearState() { localStorage.removeItem('boo_nuzlocke_save'); }

// ══════════════════════════════════════════════
// BATTLE STATE
// ══════════════════════════════════════════════
let pick = null, enemy = null;
let playerHp, enemyHp, round, phase;
let currentEnemyRoll = null;
let playerPrediction = null;
let counterCallback = null;
let abilityOverlayEl = null;
let spiritInterval = null, snowInterval = null, fadeInterval = null;
let selectedGhostIndex = 0;
let pendingRewardCards = [];
let pendingRewardItem = null;

// Item usage state for current battle
let battleItemsState = [];
let rerollMode = false;
let powerMode = 0;
let playerDiceValues = [];

// Ability state
let iceShards = 0;              // Player ice shard stack
let enemyIceShards = 0;         // Enemy ice shard stack
let sacredFires = 0;            // Player sacred fire stack
let enemySacredFires = 0;       // Enemy sacred fire stack
let lastShardsConsumed = null;  // Track for splash display
let lastFiresConsumed = null;   // Track for splash display
let committedShards = 0;        // Shards discarded before this roll
let committedFires = 0;         // Fires discarded before this roll
let redCommittedShards = 0;     // Red's committed shards (VS mode)
let redCommittedFires = 0;      // Red's committed fires (VS mode)
let redBogeyReflectArmed = false; // Red's Bogey armed state (VS mode)
let redBogeyReflectUsed = false;  // Red's Bogey used state (VS mode)
let playerBonusDice = 0;        // Extra dice for player next roll
let enemyBonusDice = 0;         // Extra dice for enemy next roll
let playerRemoveDice = 0;       // Dice removed from player next roll
let enemyRemoveDice = 0;        // Dice removed from enemy next roll
let bogeyReflectUsed = false;   // Bogey one-time reflect tracker
let bogeyReflectArmed = false;  // Player must tap shield to arm it
let isFirstRoll = true;         // For Nikon's Ambush
let tookDamageLastRound = false;// For Simon's Brew Time
let enemyHeinousUsed = false;   // Boss Logey's Heinous — once per fight max
// Powder's Final Gift adds shards directly to iceShards (persists between fights)

// ══════════════════════════════════════════════
// SCRIPTED BOSS FIGHTS — cinematic dice sequences
// Boss 0: per-starter, guaranteed win + ability showcase
// Boss 1-2: guaranteed wins with drama
// Boss 3-7: dramatic arcs, mostly winnable
// ══════════════════════════════════════════════
let bossScript = null;
let bossScriptRound = 0;

// ══════════════════════════════════════════════
// CO-OP 2v2 STATE
// ══════════════════════════════════════════════
let coopMode = false;
let coopState = null;  // { currentBoss, p1:{collection,items,deadGhosts,killedBy,battleWins,selectedIdx}, p2:{...}, stats }
let coopP1 = null, coopP2 = null;       // active player ghost objects in battle
let coopE1 = null, coopE2 = null;       // enemy ghost objects (boss + partner)
let coopP1Hp = 0, coopP2Hp = 0;
let coopE1Hp = 0, coopE2Hp = 0;
let coopTurn = 1;                        // whose turn: 1 or 2
let coopTarget = 1;                      // which enemy targeted: 1 or 2
let coopPickingPlayer = 1;
let coopSelectedGhost = null;
let coopRound = 0;

function newCoopState() {
  return {
    currentBoss: 0,
    p1: { collection: [], items: [], deadGhosts: [], killedBy: {}, battleWins: [], selectedIdx: 0 },
    p2: { collection: [], items: [], deadGhosts: [], killedBy: {}, battleWins: [], selectedIdx: 0 },
    stats: { bossesBeaten: 0, ghostsLost: 0, totalRolls: 0, itemsUsed: 0 },
    usedCards: BOSSES.map(b => b.name)
  };
}

function saveCoopState() { localStorage.setItem('boo_coop_save', JSON.stringify(coopState)); }
function loadCoopState() { try { return JSON.parse(localStorage.getItem('boo_coop_save')); } catch { return null; } }
function clearCoopState() { localStorage.removeItem('boo_coop_save'); }
