// ACHIEVEMENTS
// Simple achievement tracking system
// Extracted as core module — v7.1.0

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', desc: 'Win your first battle', check: () => (G.rep?.battlesWon || 0) >= 1 },
  { id: 'ten_wins', name: 'Seasoned Fighter', desc: 'Win 10 battles', check: () => (G.rep?.battlesWon || 0) >= 10 },
  { id: 'first_craft', name: 'Artisan', desc: 'Craft your first item', check: () => (G.rep?.craftsCompleted || 0) >= 1 },
  { id: 'master_crafter', name: 'Master Crafter', desc: 'Craft 20 items', check: () => (G.rep?.craftsCompleted || 0) >= 20 },
  { id: 'explorer', name: 'Explorer', desc: 'Visit all 4 regions', check: () => (G.visitedTiles?.size || 0) > 500 },
  { id: 'collector', name: 'Collector', desc: 'Own 6 Spiritkin', check: () => (G.team?.length || 0) >= 6 },
  { id: 'rich', name: 'Wealthy', desc: 'Have 500+ coins', check: () => (G.coins || 0) >= 500 },
  { id: 'social', name: 'Social Butterfly', desc: 'Join a guild', check: () => !!(G.guild?.id) },
  { id: 'homeowner', name: 'Homeowner', desc: 'Claim a house', check: () => !!(G.house) },
  { id: 'curse_breaker', name: 'Curse Breaker', desc: 'Complete the Mask of Destiny', check: () => (G.maskQuest?.completedDays || 0) >= 1 },
  { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Contribute to a world boss defeat', check: () => G.titles?.includes('Boss Slayer') },
  { id: 'lore_hunter', name: 'Lore Hunter', desc: 'Find all lore tablets', check: () => (G.loreCollected?.length || 0) >= 14 },
];

function checkAchievements() {
  if (!G.achievements) G.achievements = [];
  for (const ach of ACHIEVEMENTS) {
    if (G.achievements.includes(ach.id)) continue;
    if (ach.check()) {
      G.achievements.push(ach.id);
      notify('Achievement Unlocked: ' + ach.name + '!');
      if (typeof saveGame === 'function') saveGame();
    }
  }
}

// Run every 30 seconds
setInterval(checkAchievements, 30000);
