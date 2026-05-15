// ═══════════════════════════════════════════════════
// BATTLE OF ORIGINS — Phaser 4 Config & Global State
// ═══════════════════════════════════════════════════

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  pixelArt: true,
  // transparent: true, // DISABLED — breaks Phaser 4 scene loading. Battle transparency handled by overlay rect.
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [], // Scenes added after all scripts load
};

// Global player state (same structure as the 2D version's G object)
const G = {
  name: 'Adventurer',
  discipline: 'warrior',
  level: 1,
  xp: 0,
  coins: 100,
  x: 25, y: 25,
  team: [],
  activeIdx: 0,
  inBattle: false,
  rep: { battlesWon: 0, craftsCompleted: 0, itemsSold: 0, essencesCollected: 0, raresFound: 0 },
  hostileNPCsDefeated: {},
  titles: [],
  // Wave 6: onboarding + multiplayer
  spriteKey: 'player',       // character sprite choice (default = Boy_walk)
  playerId: null,            // unique multiplayer ID (generated on first run)
  tutorialStep: 0,           // 0-4, tutorial progression
  tutorialComplete: false,   // true after tutorial finishes
  essences: [],
  gear: [],
  equipped: { weapon: null, head: null, accessory: null },
  mastery: { weapon: { xp: 0 }, armor: { xp: 0 }, accessory: { xp: 0 } },
  quests: { active: [], completed: [] },
  loreCollected: [],
  unlockedSkills: [],
  // Resources
  iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0,
  surge: 0, moonstone: 0, firefly: 0,
  // Zone system
  currentZone: 'frost_valley',
  // Starting class (chosen during onboarding)
  startingClass: null,
};
