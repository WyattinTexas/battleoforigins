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
      { text: '★ The Corruptor ★', offsetY: -40, style: { fontSize: '8px', fontFamily: 'monospace', color: '#ff8844' } },
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
        { type: 'comm', speaker: 'Crazy Lou', text: 'He comes. Prepare yourself.', color: '#ff8844', duration: 3000 },
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
        { type: 'huntPlayer', speed: 280, aggroRange: 8 },
        { type: 'attackNPCs', radius: 60, cooldownMs: 4000, fx: 'fireball',
          onKillMultiple: 5,
          onKillComm: { speaker: 'Valkin', text: 'Kill-takular!', color: '#cc66ff', duration: 2500 },
          respawnMs: 5 * 60 * 1000 },
      ],
    },
  ],

  collisionTrigger: {
    type: 'battle',
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
