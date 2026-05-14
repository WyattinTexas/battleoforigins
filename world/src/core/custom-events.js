// ══════════════════════════════════════════════════════════
//  CUSTOM WORLD EVENTS — Script Definitions
//  Events are data configs consumed by EventEngine.
//  Add new events here; the engine handles the runtime.
// ══════════════════════════════════════════════════════════

// ── Valkin the Grand ──
const VALKIN_SCRIPT = {
  id: 'valkin_the_grand',
  name: 'Valkin the Grand',
  singleton: true,
  expiresAfterMs: 30 * 60 * 1000,

  onExpire: {
    comm: { speaker: 'Valkin', text: 'This land bores me. I will return.', color: '#cc66ff' },
  },

  sprite: {
    key: 'npc_knight',
    fallbackKey: 'npc_elder',
    scale: 2.8,
    tint: 0xaa44ff,
    depth: 10,
    labels: [
      { text: 'Valkin the Grand', offsetY: -28, style: { fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff4444', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } } },
    ],
  },

  spawnAt: { x: 'HUB.x + 15', y: 'HUB.y + 3' },

  battle: {
    team: [
      { cardId: 62,  name: 'Raditz',          hp: 6,  role: 'lead' },
      { cardId: 432, name: 'Valkin the Grand', hp: 30, role: 'boss' },
      { cardId: 424, name: 'Bigsby',           hp: 5,  role: 'closer' },
    ],
    sceneData: { trainerName: 'Valkin the Grand', _valkinEvent: true },
    type: 'valkin',
  },

  phases: [
    {
      id: 'approaching',
      actions: [
        { type: 'notify', text: '⚠ VALKIN THE GRAND APPROACHES! ⚠' },
        { type: 'moveTo', x: 'HUB.x + 3', y: 'HUB.y + 4', speed: 60 },
      ],
    },
    {
      id: 'declaring',
      actions: [
        { type: 'comm', speaker: 'Valkin', text: 'I declare war on the intruders!', color: '#ff4444', duration: 4000 },
        { type: 'notify', text: '⚠ VALKIN DECLARES WAR! ⚠' },
        { type: 'wait', ms: 5000 },
        { type: 'comm', speaker: 'Valkin', text: 'Now... who wants to go first?', color: '#cc66ff', duration: 3000 },
      ],
    },
    {
      id: 'hunting',
      actions: [
        { type: 'huntPlayer', speed: 280, aggroRange: 4 },
        { type: 'attackNPCs', radius: 60, cooldownMs: 4000, fx: 'fireball',
          onKillMultiple: 5,
          onKillComm: { speaker: 'Valkin', text: 'Kill-takular!', color: '#cc66ff', duration: 2500 },
          respawnMs: 5 * 60 * 1000 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Valkin', text: 'Now we settle this!', color: '#cc66ff', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 40,
    target: 'player',
  },
};

// ══════════════════════════════════════════════════════════
//  LEGACY WRAPPERS — keep old function names working
// ══════════════════════════════════════════════════════════

function spawnValkinEvent(scene) {
  if (typeof EventEngine !== 'undefined') {
    EventEngine.start(VALKIN_SCRIPT, scene);
  }
}

function updateValkinEvent(scene) {
  // No-op: EventEngine.update() handles all events now
}

function updateValkinHunt(scene) {
  // No-op: legacy compat
}

function triggerValkinBattle(scene) {
  // No-op: collision trigger in EventEngine handles this
}

// ── Chat as event character (local only) ──
function valkinChat(text) {
  try {
    if (typeof GameChat !== 'undefined' && GameChat._onMessage) {
      GameChat._onMessage({ name: 'Valkin the Grand', text: text, level: 99, ts: Date.now() });
    }
  } catch(e) { /* silently fail */ }
}

function showValkinDialogue(scene, text) {
  if (scene && scene.comm) scene.comm.show('Valkin', text, { color: '#cc66ff', duration: 3000 });
}

// ══════════════════════════════════════════════════════════
//  ZONE EVENTS — NPC Talks, Wild Ambushes, Mini-Bosses,
//  Treasure Discoveries, Traveling Merchants
//  Added below existing Valkin event. Do not modify above.
// ══════════════════════════════════════════════════════════

// ┌─────────────────────────────────────┐
// │       FROST VALLEY (starter)        │
// │  Friendly, cautious, easiest zone   │
// │  HUB ~(15,20), region default       │
// └─────────────────────────────────────┘

// ── FV 1: NPC Talk — Old Hermit Wren ──
const FV_HERMIT_WREN_SCRIPT = {
  id: 'fv_hermit_wren',
  name: 'Hermit Wren',
  singleton: true,

  sprite: {
    key: 'npc_elder',
    scale: 2,
    tint: 0x88aacc,
    depth: 10,
    labels: [
      { text: 'Hermit Wren', offsetY: -24, style: { fontSize: '9px', fontFamily: 'Georgia, serif', color: '#aaddff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 10, y: 14 },
  triggerRadius: 2,

  phases: [
    {
      id: 'greet',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'fv_hermit_wren_met', gotoPhase: 'already_met' },
        { type: 'comm', speaker: 'Hermit Wren', text: 'Well now. A traveler in the valley. Rare sight these days.', color: '#aaddff', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Hermit Wren', text: 'The frost spirits here are gentle, mostly. Stick near the hub and you will be fine.', color: '#aaddff', duration: 4000 },
        { type: 'wait', ms: 4200 },
        { type: 'comm', speaker: 'Hermit Wren', text: 'Take these coins. Buy yourself something warm.', color: '#aaddff', duration: 3000 },
        { type: 'giveReward', coins: 15, xp: 5, message: '+15 coins, +5 XP from Hermit Wren' },
        { type: 'setFlag', key: 'fv_hermit_wren_met', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'already_met',
      actions: [
        { type: 'waitForInteract' },
        { type: 'comm', speaker: 'Hermit Wren', text: 'Still here? Good. The valley needs watchful eyes.', color: '#aaddff', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],
};

// ── FV 2: Wild Ambush — Frostbite Patrol ──
const FV_WILD_AMBUSH_SCRIPT = {
  id: 'fv_wild_ambush',
  name: 'Frost Prowler',
  singleton: true,
  expiresAfterMs: 5 * 60 * 1000,

  sprite: {
    key: 'npc_hunter',
    scale: 2,
    tint: 0x4488cc,
    depth: 10,
    labels: [
      { text: 'Frost Prowler', offsetY: -24, style: { fontSize: '9px', fontFamily: 'monospace', color: '#88ccff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 40, y: 8 },  // Deep Frost Valley wilds, far from hub

  battle: {
    team: [
      { cardId: 23, name: 'Powder', hp: 5, role: 'lead' },
      { cardId: 29, name: 'Sad Sal', hp: 5, role: 'closer' },
    ],
    sceneData: { trainerName: 'Frost Prowler' },
    type: 'event',
  },

  phases: [
    {
      id: 'hunting',
      actions: [
        { type: 'huntPlayer', speed: 160, aggroRange: 3 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Frost Prowler', text: 'You won\'t escape the cold!', color: '#88ccff', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 36,
    target: 'player',
  },
};

// ── FV 3: Mini-Boss — Glacius the Frozen Warden ──
const FV_MINIBOSS_GLACIUS_SCRIPT = {
  id: 'fv_miniboss_glacius',
  name: 'Glacius',
  singleton: true,
  expiresAfterMs: 15 * 60 * 1000,

  sprite: {
    key: 'npc_knight',
    scale: 2.4,
    tint: 0x4466cc,
    depth: 10,
    labels: [
      { text: 'Glacius', offsetY: -28, style: { fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#66aaff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } } },
      { text: '★ Frozen Warden ★', offsetY: -40, style: { fontSize: '8px', fontFamily: 'monospace', color: '#88ccff' } },
    ],
  },

  spawnAt: { x: 25, y: 10 },

  battle: {
    team: [
      { cardId: 104, name: 'Skylar', hp: 7, role: 'lead' },
      { cardId: 81,  name: 'Spockles', hp: 6, role: 'support' },
      { cardId: 114, name: 'Romy', hp: 8, role: 'boss' },
    ],
    sceneData: { trainerName: 'Glacius the Frozen Warden' },
    type: 'event',
  },

  phases: [
    {
      id: 'intro',
      actions: [
        { type: 'checkFlag', key: 'fv_glacius_defeated', gotoPhase: 'defeated_line' },
        { type: 'huntPlayer', speed: 200, aggroRange: 3 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Glacius', text: 'You won\'t escape the cold!', color: '#66aaff', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
    {
      id: 'defeated_line',
      actions: [
        { type: 'comm', speaker: 'Glacius', text: 'You have earned passage. The valley remembers strength.', color: '#66aaff', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 40,
    target: 'player',
  },

  onExpire: {
    comm: { speaker: 'Glacius', text: 'The cold claims all eventually.', color: '#66aaff' },
  },
};

// ── FV 4: Treasure Discovery — Treasure Chest ──
const FV_TREASURE_FROZEN_CHEST_SCRIPT = {
  id: 'fv_treasure_frozen_chest',
  name: 'Treasure Chest',
  singleton: true,

  sprite: {
    key: 'chest_wooden',
    scale: 0.8,
    depth: 6,
    labels: [
      { text: '?', offsetY: -16, style: { fontSize: '12px', fontFamily: 'serif', color: '#ffdd88' } },
    ],
  },

  spawnAt: { x: 8, y: 25 },

  phases: [
    {
      id: 'discover',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'fv_frozen_chest_opened', gotoPhase: 'empty' },
        { type: 'comm', speaker: 'Narrator', text: 'A Treasure Chest! The ice cracks as you pry it open.', color: '#ccddff', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Narrator', text: 'Inside: a handful of coins and a note that reads "stay warm."', color: '#ccddff', duration: 3000 },
        { type: 'giveReward', coins: 25, xp: 10, message: '+25 coins, +10 XP from Treasure Chest' },
        { type: 'setFlag', key: 'fv_frozen_chest_opened', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'empty',
      actions: [
        { type: 'wait', ms: 300 },
        { type: 'comm', speaker: 'Narrator', text: 'The cache is empty. You already claimed its contents.', color: '#999999', duration: 2500 },
        { type: 'endEvent' },
      ],
    },
  ],
};

// ── FV 5: Traveling Merchant — Frosty Peddler ──
const FV_MERCHANT_PEDDLER_SCRIPT = {
  id: 'fv_merchant_peddler',
  name: 'Frosty Peddler',
  singleton: true,

  sprite: {
    key: 'npc_elder',
    scale: 2,
    tint: 0x99bbdd,
    depth: 10,
    labels: [
      { text: 'Frosty Peddler', offsetY: -24, style: { fontSize: '9px', fontFamily: 'Georgia, serif', color: '#ddeeff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 18, y: 24 },

  phases: [
    {
      id: 'greet',
      actions: [
        { type: 'waitForInteract' },
        { type: 'comm', speaker: 'Frosty Peddler', text: 'Brr! Cold day for business. But I have wares worth the chill.', color: '#ddeeff', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Frosty Peddler', text: 'Here, a warming charm. Should keep you steady in battle.', color: '#ddeeff', duration: 3000 },
        { type: 'giveBuff', id: 'frostward', name: 'Frostward', effects: { damageBonus: 1 }, durationMs: 120000, icon: '❄', color: '#88bbff', source: 'Frosty Peddler' },
        { type: 'notify', text: 'Buff received: Frostward (+1 damage, 2 min)' },
        { type: 'endEvent' },
      ],
    },
  ],
};


// ┌─────────────────────────────────────┐
// │         ROLLING HILLS               │
// │  Warm, pastoral, medium difficulty   │
// │  HUB_MEADOW ~(28,52), y >= 45       │
// └─────────────────────────────────────┘

// ── RH 1: NPC Talk — Farmer Tomas ──
const RH_FARMER_TOMAS_SCRIPT = {
  id: 'rh_farmer_tomas',
  name: 'Farmer Tomas',
  singleton: true,

  sprite: {
    key: 'npc_elder',
    scale: 2,
    tint: 0x6a8a3a,
    depth: 10,
    labels: [
      { text: 'Farmer Tomas', offsetY: -24, style: { fontSize: '9px', fontFamily: 'Georgia, serif', color: '#bbdd88', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 32, y: 55 },

  phases: [
    {
      id: 'greet',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'rh_farmer_tomas_met', gotoPhase: 'return_visit' },
        { type: 'comm', speaker: 'Farmer Tomas', text: 'Welcome to the Hills! Finest soil in the whole realm.', color: '#bbdd88', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Farmer Tomas', text: 'The spirits around here are mostly friendly. Mostly.', color: '#bbdd88', duration: 3000 },
        { type: 'giveReward', coins: 10, xp: 5, message: '+10 coins, +5 XP from Farmer Tomas' },
        { type: 'setFlag', key: 'rh_farmer_tomas_met', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'return_visit',
      actions: [
        { type: 'waitForInteract' },
        { type: 'comm', speaker: 'Farmer Tomas', text: 'Back again? The harvest has been good this season.', color: '#bbdd88', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],
};

// ── RH 2: Wild Ambush — Meadow Stalker ──
const RH_WILD_AMBUSH_SCRIPT = {
  id: 'rh_wild_ambush',
  name: 'Meadow Stalker',
  singleton: true,
  expiresAfterMs: 5 * 60 * 1000,

  sprite: {
    key: 'npc_hunter',
    scale: 2,
    tint: 0x558844,
    depth: 10,
    labels: [
      { text: 'Meadow Stalker', offsetY: -24, style: { fontSize: '9px', fontFamily: 'monospace', color: '#88cc66', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 48, y: 68 },  // Deep Rolling Hills wilds, far south of hub

  battle: {
    team: [
      { cardId: 311, name: 'Pudge', hp: 7, role: 'lead' },
      { cardId: 308, name: 'Kaplan', hp: 5, role: 'support' },
      { cardId: 79,  name: 'Laura', hp: 4, role: 'closer' },
    ],
    sceneData: { trainerName: 'Meadow Stalker' },
    type: 'event',
  },

  phases: [
    {
      id: 'hunting',
      actions: [
        { type: 'huntPlayer', speed: 200, aggroRange: 3.5 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Meadow Stalker', text: 'You shouldn\'t have wandered here!', color: '#88cc44', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 36,
    target: 'player',
  },
};

// ── RH 3: Mini-Boss — Thornmother Briar ──
const RH_MINIBOSS_BRIAR_SCRIPT = {
  id: 'rh_miniboss_briar',
  name: 'Thornmother Briar',
  singleton: true,
  expiresAfterMs: 15 * 60 * 1000,

  sprite: {
    key: 'npc_knight',
    scale: 2.4,
    tint: 0x448833,
    depth: 10,
    labels: [
      { text: 'Thornmother Briar', offsetY: -28, style: { fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#66cc44', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } } },
      { text: '★ Nature\'s Fury ★', offsetY: -40, style: { fontSize: '8px', fontFamily: 'monospace', color: '#88ee66' } },
    ],
  },

  spawnAt: { x: 22, y: 60 },

  battle: {
    team: [
      { cardId: 210, name: 'Timber', hp: 6, role: 'lead' },
      { cardId: 305, name: 'Selene', hp: 6, role: 'support' },
      { cardId: 314, name: 'Farmer Jeff', hp: 5, role: 'boss' },
    ],
    sceneData: { trainerName: 'Thornmother Briar' },
    type: 'event',
  },

  phases: [
    {
      id: 'intro',
      actions: [
        { type: 'checkFlag', key: 'rh_briar_defeated', gotoPhase: 'defeated_line' },
        { type: 'huntPlayer', speed: 220, aggroRange: 3.5 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Thornmother Briar', text: 'You shouldn\'t have wandered here!', color: '#88cc44', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
    {
      id: 'defeated_line',
      actions: [
        { type: 'comm', speaker: 'Thornmother Briar', text: 'The hills accept you. Walk gently.', color: '#66cc44', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 40,
    target: 'player',
  },

  onExpire: {
    comm: { speaker: 'Thornmother Briar', text: 'The roots reclaim what is theirs.', color: '#66cc44' },
  },
};

// ── RH 4: Treasure Discovery — Treasure Chest ──
const RH_TREASURE_MOSSY_STASH_SCRIPT = {
  id: 'rh_treasure_mossy_stash',
  name: 'Treasure Chest',
  singleton: true,

  sprite: {
    key: 'chest_wooden2',
    scale: 0.8,
    depth: 6,
    labels: [
      { text: '?', offsetY: -16, style: { fontSize: '12px', fontFamily: 'serif', color: '#88dd66' } },
    ],
  },

  spawnAt: { x: 40, y: 58 },

  phases: [
    {
      id: 'discover',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'rh_mossy_stash_opened', gotoPhase: 'empty' },
        { type: 'comm', speaker: 'Narrator', text: 'A mound of moss hides something beneath. You dig carefully.', color: '#aaddaa', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Narrator', text: 'A leather pouch with coins and seeds. Someone\'s forgotten savings.', color: '#aaddaa', duration: 3000 },
        { type: 'giveReward', coins: 30, xp: 15, message: '+30 coins, +15 XP from Treasure Chest' },
        { type: 'setFlag', key: 'rh_mossy_stash_opened', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'empty',
      actions: [
        { type: 'wait', ms: 300 },
        { type: 'comm', speaker: 'Narrator', text: 'Just moss now. Nothing left to find.', color: '#999999', duration: 2500 },
        { type: 'endEvent' },
      ],
    },
  ],
};


// ┌─────────────────────────────────────┐
// │        VOLCANIC ISLES               │
// │  Intense, passionate, harder zone   │
// │  HUB_VOLCANIC ~(68,28), x>60 y<43  │
// └─────────────────────────────────────┘

// ── VI 1: NPC Talk — Ember Scout Kael ──
const VI_EMBER_SCOUT_SCRIPT = {
  id: 'vi_ember_scout_kael',
  name: 'Ember Scout Kael',
  singleton: true,

  sprite: {
    key: 'npc_hunter',
    scale: 2,
    tint: 0xcc6622,
    depth: 10,
    labels: [
      { text: 'Ember Scout Kael', offsetY: -24, style: { fontSize: '9px', fontFamily: 'Georgia, serif', color: '#ffaa44', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 72, y: 20 },

  phases: [
    {
      id: 'greet',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'vi_kael_met', gotoPhase: 'return_visit' },
        { type: 'comm', speaker: 'Kael', text: 'The ground is hot here. Watch where you step.', color: '#ffaa44', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Kael', text: 'Spirits on these isles burn with real fire. Respect them or suffer.', color: '#ffaa44', duration: 3500 },
        { type: 'giveReward', coins: 10, xp: 8, message: '+10 coins, +8 XP from Kael' },
        { type: 'setFlag', key: 'vi_kael_met', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'return_visit',
      actions: [
        { type: 'waitForInteract' },
        { type: 'comm', speaker: 'Kael', text: 'Still standing? The isles have not broken you yet.', color: '#ffaa44', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],
};

// ── VI 2: Wild Ambush — Lava Lurker ──
const VI_WILD_AMBUSH_SCRIPT = {
  id: 'vi_wild_ambush',
  name: 'Lava Lurker',
  singleton: true,
  expiresAfterMs: 5 * 60 * 1000,

  sprite: {
    key: 'npc_hunter',
    scale: 2.2,
    tint: 0xee4422,
    depth: 10,
    labels: [
      { text: 'Lava Lurker', offsetY: -24, style: { fontSize: '9px', fontFamily: 'monospace', color: '#ff6644', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 82, y: 10 },  // Deep Volcanic Isles wilds, far from hub

  battle: {
    team: [
      { cardId: 304, name: 'The Ember Force', hp: 3, role: 'lead' },
      { cardId: 336, name: 'Humar', hp: 5, role: 'closer' },
      { cardId: 313, name: 'Sylvia', hp: 4, role: 'support' },
    ],
    sceneData: { trainerName: 'Lava Lurker' },
    type: 'event',
  },

  phases: [
    {
      id: 'hunting',
      actions: [
        { type: 'huntPlayer', speed: 240, aggroRange: 3.5 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Lava Lurker', text: 'The heat claims another!', color: '#ff6644', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 36,
    target: 'player',
  },
};

// ── VI 3: Mini-Boss — Pyrax the Molten King ──
const VI_MINIBOSS_PYRAX_SCRIPT = {
  id: 'vi_miniboss_pyrax',
  name: 'Pyrax',
  singleton: true,
  expiresAfterMs: 15 * 60 * 1000,

  sprite: {
    key: 'npc_knight',
    scale: 2.6,
    tint: 0xcc3300,
    depth: 10,
    labels: [
      { text: 'Pyrax', offsetY: -28, style: { fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ff4400', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } } },
      { text: '★ Molten King ★', offsetY: -40, style: { fontSize: '8px', fontFamily: 'monospace', color: '#ffaa44' } },
    ],
  },

  spawnAt: { x: 75, y: 30 },

  battle: {
    team: [
      { cardId: 306, name: 'Nerina', hp: 9, role: 'lead' },
      { cardId: 418, name: 'Pip', hp: 7, role: 'support' },
      { cardId: 336, name: 'Humar', hp: 5, role: 'boss' },
    ],
    sceneData: { trainerName: 'Pyrax the Molten King' },
    type: 'event',
  },

  phases: [
    {
      id: 'intro',
      actions: [
        { type: 'checkFlag', key: 'vi_pyrax_defeated', gotoPhase: 'defeated_line' },
        { type: 'huntPlayer', speed: 260, aggroRange: 4 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Pyrax', text: 'The heat claims another!', color: '#ff6644', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
    {
      id: 'defeated_line',
      actions: [
        { type: 'comm', speaker: 'Pyrax', text: 'The flame bows to your strength. For now.', color: '#ff4400', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 40,
    target: 'player',
  },

  onExpire: {
    comm: { speaker: 'Pyrax', text: 'The eruption can wait. But not forever.', color: '#ff4400' },
  },
};

// ── VI 4: Traveling Merchant — Ashwalker Nima ──
const VI_MERCHANT_NIMA_SCRIPT = {
  id: 'vi_merchant_nima',
  name: 'Ashwalker Nima',
  singleton: true,

  sprite: {
    key: 'npc_elder',
    scale: 2,
    tint: 0xdd7733,
    depth: 10,
    labels: [
      { text: 'Ashwalker Nima', offsetY: -24, style: { fontSize: '9px', fontFamily: 'Georgia, serif', color: '#ffcc88', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 105, y: 8 },  // Deep Dark Castle wilds, far corner

  phases: [
    {
      id: 'greet',
      actions: [
        { type: 'waitForInteract' },
        { type: 'comm', speaker: 'Nima', text: 'Walk the ash long enough and it becomes home. I have gifts for the bold.', color: '#ffcc88', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Nima', text: 'This salve will harden your skin against the heat.', color: '#ffcc88', duration: 3000 },
        { type: 'giveBuff', id: 'molten_skin', name: 'Molten Skin', effects: { defense: 2 }, durationMs: 120000, icon: '🔥', color: '#ff6644', source: 'Ashwalker Nima' },
        { type: 'notify', text: 'Buff received: Molten Skin (+2 defense, 2 min)' },
        { type: 'endEvent' },
      ],
    },
  ],
};


// ┌─────────────────────────────────────┐
// │          DARK CASTLE                │
// │  Mysterious, foreboding, hardest    │
// │  HUB_DARK ~(92,15), x>88 y<42      │
// └─────────────────────────────────────┘

// ── DC 1: Wild Ambush — Shadow Revenant ──
const DC_WILD_AMBUSH_SCRIPT = {
  id: 'dc_wild_ambush',
  name: 'Shadow Revenant',
  singleton: true,
  expiresAfterMs: 5 * 60 * 1000,

  sprite: {
    key: 'npc_hunter',
    scale: 2.2,
    tint: 0x6633aa,
    depth: 10,
    labels: [
      { text: 'Shadow Revenant', offsetY: -24, style: { fontSize: '9px', fontFamily: 'monospace', color: '#aa88cc', backgroundColor: '#00000088', padding: { x: 2, y: 1 } } },
    ],
  },

  spawnAt: { x: 98, y: 12 },

  battle: {
    team: [
      { cardId: 111, name: 'Shade', hp: 5, role: 'lead' },
      { cardId: 78,  name: 'Haywire', hp: 7, role: 'support' },
      { cardId: 96,  name: 'Hector', hp: 6, role: 'closer' },
    ],
    sceneData: { trainerName: 'Shadow Revenant' },
    type: 'event',
  },

  phases: [
    {
      id: 'hunting',
      actions: [
        { type: 'huntPlayer', speed: 260, aggroRange: 4 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Shadow Revenant', text: 'You trespass in shadow...', color: '#aa88cc', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 36,
    target: 'player',
  },
};

// ── DC 2: Mini-Boss — Dreadlord Malachar ──
const DC_MINIBOSS_MALACHAR_SCRIPT = {
  id: 'dc_miniboss_malachar',
  name: 'Dreadlord Malachar',
  singleton: true,
  expiresAfterMs: 15 * 60 * 1000,

  sprite: {
    key: 'npc_knight',
    scale: 2.6,
    tint: 0x552288,
    depth: 10,
    labels: [
      { text: 'Dreadlord Malachar', offsetY: -28, style: { fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#cc44ff', backgroundColor: '#000000aa', padding: { x: 3, y: 1 } } },
      { text: '★ Lord of Shadows ★', offsetY: -40, style: { fontSize: '8px', fontFamily: 'monospace', color: '#aa66cc' } },
    ],
  },

  spawnAt: { x: 96, y: 18 },

  battle: {
    team: [
      { cardId: 108, name: 'Lucy', hp: 8, role: 'lead' },
      { cardId: 97,  name: 'Toby', hp: 7, role: 'support' },
      { cardId: 432, name: 'Valkin the Grand', hp: 8, role: 'boss' },
    ],
    sceneData: { trainerName: 'Dreadlord Malachar' },
    type: 'event',
  },

  phases: [
    {
      id: 'intro',
      actions: [
        { type: 'checkFlag', key: 'dc_malachar_defeated', gotoPhase: 'defeated_line' },
        { type: 'huntPlayer', speed: 280, aggroRange: 4.5 },
      ],
    },
    {
      id: 'confrontation',
      actions: [
        { type: 'freezePlayer' },
        { type: 'comm', speaker: 'Malachar', text: 'You trespass in shadow...', color: '#aa88cc', duration: 2500 },
        { type: 'wait', ms: 2500 },
        { type: 'battle' },
      ],
    },
    {
      id: 'defeated_line',
      actions: [
        { type: 'comm', speaker: 'Malachar', text: 'Impossible. The darkness itself bows to you.', color: '#cc44ff', duration: 3000 },
        { type: 'endEvent' },
      ],
    },
  ],

  collisionTrigger: {
    phase: 'confrontation',
    radius: 40,
    target: 'player',
  },

  onExpire: {
    comm: { speaker: 'Malachar', text: 'Darkness is patient. I will return.', color: '#cc44ff' },
  },
};

// ── DC 3: Treasure Discovery — Treasure Chest ──
const DC_TREASURE_RELIQUARY_SCRIPT = {
  id: 'dc_treasure_reliquary',
  name: 'Treasure Chest',
  singleton: true,

  sprite: {
    key: 'chest_wooden3',
    scale: 0.8,
    tint: 0x8866aa,
    depth: 6,
    labels: [
      { text: '?', offsetY: -16, style: { fontSize: '12px', fontFamily: 'serif', color: '#bb88dd' } },
    ],
  },

  spawnAt: { x: 100, y: 22 },

  phases: [
    {
      id: 'discover',
      actions: [
        { type: 'waitForInteract' },
        { type: 'checkFlag', key: 'dc_reliquary_opened', gotoPhase: 'empty' },
        { type: 'comm', speaker: 'Narrator', text: 'An ancient reliquary pulses with dark energy. You pry it open.', color: '#bb88dd', duration: 3500 },
        { type: 'wait', ms: 3800 },
        { type: 'comm', speaker: 'Narrator', text: 'Coins stamped with a forgotten king\'s face. And something else... power.', color: '#bb88dd', duration: 3500 },
        { type: 'giveReward', coins: 50, xp: 25, message: '+50 coins, +25 XP from Treasure Chest' },
        { type: 'setFlag', key: 'dc_reliquary_opened', value: true },
        { type: 'endEvent' },
      ],
    },
    {
      id: 'empty',
      actions: [
        { type: 'wait', ms: 300 },
        { type: 'comm', speaker: 'Narrator', text: 'The reliquary is hollow. Its power was already claimed.', color: '#999999', duration: 2500 },
        { type: 'endEvent' },
      ],
    },
  ],
};


// ══════════════════════════════════════════════════════════
//  ZONE EVENT SPAWNER — called from WorldScene on region
//  entry to start zone-appropriate events.
//
//  Usage from WorldScene.checkRegionTransition():
//    if (typeof spawnZoneEvents === 'function') spawnZoneEvents(region, scene);
// ══════════════════════════════════════════════════════════

const ZONE_EVENT_MAP = {
  frost_valley: [
    FV_HERMIT_WREN_SCRIPT,
    // FV_WILD_AMBUSH_SCRIPT, // Removed — Frost Prowler combat not working
    FV_MINIBOSS_GLACIUS_SCRIPT,
    FV_TREASURE_FROZEN_CHEST_SCRIPT,
    FV_MERCHANT_PEDDLER_SCRIPT,
  ],
  rolling_hills: [
    RH_FARMER_TOMAS_SCRIPT,
    RH_WILD_AMBUSH_SCRIPT,
    RH_MINIBOSS_BRIAR_SCRIPT,
    RH_TREASURE_MOSSY_STASH_SCRIPT,
  ],
  volcanic_isles: [
    VI_EMBER_SCOUT_SCRIPT,
    VI_WILD_AMBUSH_SCRIPT,
    VI_MINIBOSS_PYRAX_SCRIPT,
    VI_MERCHANT_NIMA_SCRIPT,
  ],
  dark_castle: [
    DC_WILD_AMBUSH_SCRIPT,
    DC_MINIBOSS_MALACHAR_SCRIPT,
    DC_TREASURE_RELIQUARY_SCRIPT,
  ],
};

function spawnZoneEvents(region, scene) {
  if (typeof EventEngine === 'undefined') return;
  var scripts = ZONE_EVENT_MAP[region];
  if (!scripts) return;
  for (var i = 0; i < scripts.length; i++) {
    EventEngine.start(scripts[i], scene);
  }
}
