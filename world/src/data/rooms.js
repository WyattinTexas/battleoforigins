// ═══════════════════════════════════════════════════════════════
//  ROOM CONFIGS — Data-driven interior room definitions
//  Each hub gets unique rooms with zone-appropriate palettes.
//  BuildingScene reads these via ROOM_CONFIGS[roomId].
// ═══════════════════════════════════════════════════════════════

const ROOM_CONFIGS = {
  // ═══════ FROST VALLEY (Polaris) — Cozy log cabins ═══════
  frost_inn: {
    id: 'frost_inn', name: 'The Frosty Inn', zone: 'frost_valley',
    size: { w: 14, h: 10 },
    floorColor: 0x5a4a3a, wallColor: 0x3a2a1a, accentColor: 0x6a5a4a,
    npc: { name: 'Innkeeper Mira', tint: 0xdaa520, key: 'npc_elder',
      dialogue: ['Rest well, traveler. The frost outside bites hard.', 'Your team looks weary. Stay as long as you need.', 'I heard Valkin was spotted near the hub again. Be careful.'],
      action: 'inn' },
    furniture: [
      { type: 'rect', x: 2, y: 2, w: 2, h: 1, color: 0x4a3a2a, label: 'Bed' },
      { type: 'rect', x: 10, y: 2, w: 2, h: 1, color: 0x4a3a2a, label: 'Bed' },
      { type: 'rect', x: 6, y: 3, w: 2, h: 1, color: 0x5a4a3a, label: 'Table' },
      { type: 'rect', x: 5, y: 3, w: 1, h: 1, color: 0x3a3a3a, label: 'Chair' },
      { type: 'rect', x: 8, y: 3, w: 1, h: 1, color: 0x3a3a3a, label: 'Chair' },
      { type: 'rect', x: 1, y: 5, w: 1, h: 1, color: 0x885522, label: 'Fireplace' },
      { type: 'rect', x: 12, y: 7, w: 1, h: 1, color: 0x443322, label: 'Barrel' },
    ],
    counterY: 1,
    exitDoor: { x: 7, y: 9 },
  },

  frost_workshop: {
    id: 'frost_workshop', name: 'The Forge', zone: 'frost_valley',
    size: { w: 12, h: 9 },
    floorColor: 0x4a4a4a, wallColor: 0x2a2a2a, accentColor: 0x5a3a2a,
    npc: { name: 'Smith Ember', tint: 0xe07020, key: 'npc_hunter',
      dialogue: ['Iron sings when you heat it right.', 'Bring me materials and I will craft you something worth carrying.', 'The best blades are forged in frost.'],
      action: 'workshop' },
    furniture: [
      { type: 'rect', x: 2, y: 3, w: 1, h: 1, color: 0x884422, label: 'Anvil' },
      { type: 'rect', x: 9, y: 3, w: 1, h: 1, color: 0xcc4400, label: 'Forge Fire' },
      { type: 'rect', x: 3, y: 6, w: 2, h: 1, color: 0x554433, label: 'Workbench' },
      { type: 'rect', x: 7, y: 6, w: 2, h: 1, color: 0x443322, label: 'Storage' },
    ],
    counterY: 1,
  },

  frost_arena: {
    id: 'frost_arena', name: 'Polaris Arena', zone: 'frost_valley',
    size: { w: 14, h: 10 },
    floorColor: 0x8a7a5a, wallColor: 0x554433, accentColor: 0x665544,
    npc: { name: 'Arena Master Voss', tint: 0xcc4444, key: 'npc_knight',
      dialogue: ['Think you can handle the arena? Step into the ring.', 'Victory earns glory. Defeat earns wisdom.'],
      action: 'arena' },
    furniture: [
      { type: 'rect', x: 4, y: 4, w: 1, h: 1, color: 0x664422, label: 'Dummy' },
      { type: 'rect', x: 9, y: 4, w: 1, h: 1, color: 0x664422, label: 'Dummy' },
      { type: 'rect', x: 5, y: 3, w: 4, h: 4, color: 0x887755, label: 'Battle Ring' },
    ],
    counterY: 1,
  },

  frost_cantina: {
    id: 'frost_cantina', name: 'The Frozen Mug', zone: 'frost_valley',
    size: { w: 12, h: 9 },
    floorColor: 0x3a3028, wallColor: 0x2a2018, accentColor: 0x4a3a2a,
    npc: { name: 'Bartender Grix', tint: 0x66aa88, key: 'npc_elder',
      dialogue: ['What will it be? We have warm mead and cold truths.', 'The regulars say the dark riders have been more active lately.'],
      action: 'cantina' },
    furniture: [
      { type: 'rect', x: 2, y: 4, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 4, y: 5, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 8, y: 4, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 7, y: 6, w: 1, h: 1, color: 0x443322, label: 'Stool' },
    ],
    counterY: 1,
  },

  // ═══════ ROLLING HILLS (Meadowbrook) — Country cottages ═══════
  meadow_inn: {
    id: 'meadow_inn', name: 'The Sunlit Rest', zone: 'rolling_hills',
    size: { w: 14, h: 10 },
    floorColor: 0x7a8a5a, wallColor: 0x4a5a3a, accentColor: 0x8a9a6a,
    npc: { name: 'Innkeeper Wilma', tint: 0x88cc44, key: 'npc_elder',
      dialogue: ['Welcome to Meadowbrook! Best beds in the hills.', 'The flowers outside? I grew them myself. They keep the spirits happy.'],
      action: 'inn' },
    furniture: [
      { type: 'rect', x: 2, y: 2, w: 2, h: 1, color: 0x6a7a4a, label: 'Bed' },
      { type: 'rect', x: 10, y: 2, w: 2, h: 1, color: 0x6a7a4a, label: 'Bed' },
      { type: 'rect', x: 6, y: 4, w: 2, h: 1, color: 0x7a8a5a, label: 'Table' },
      { type: 'rect', x: 1, y: 6, w: 1, h: 1, color: 0x558833, label: 'Planter' },
      { type: 'rect', x: 12, y: 6, w: 1, h: 1, color: 0x558833, label: 'Planter' },
    ],
    counterY: 1,
    exitDoor: { x: 7, y: 9 },
  },

  meadow_herbalist: {
    id: 'meadow_herbalist', name: 'Sage Roots Apothecary', zone: 'rolling_hills',
    size: { w: 12, h: 9 },
    floorColor: 0x6a7a4a, wallColor: 0x3a4a2a, accentColor: 0x5a6a3a,
    npc: { name: 'Herbalist Fern', tint: 0x44aa66, key: 'npc_elder',
      dialogue: ['These roots cure what ails you. Mostly.', 'The hills grow the finest healing herbs in all the realms.'],
      action: 'shop' },
    furniture: [
      { type: 'rect', x: 2, y: 3, w: 1, h: 1, color: 0x446633, label: 'Herbs' },
      { type: 'rect', x: 3, y: 3, w: 1, h: 1, color: 0x446633, label: 'Herbs' },
      { type: 'rect', x: 8, y: 3, w: 2, h: 1, color: 0x554433, label: 'Shelf' },
      { type: 'rect', x: 5, y: 6, w: 2, h: 1, color: 0x3a4a2a, label: 'Cauldron' },
    ],
    counterY: 1,
  },

  meadow_tavern: {
    id: 'meadow_tavern', name: 'The Rolling Barrel', zone: 'rolling_hills',
    size: { w: 14, h: 10 },
    floorColor: 0x6a6a4a, wallColor: 0x3a3a2a, accentColor: 0x5a5a3a,
    npc: { name: 'Barkeep Stumpy', tint: 0xaa8844, key: 'npc_hunter',
      dialogue: ['Pull up a stool. The hills are gentle but the nights are long.', 'I hear the Thornmother is angry again. Best stay on the paths.'],
      action: 'cantina' },
    furniture: [
      { type: 'rect', x: 2, y: 4, w: 2, h: 1, color: 0x554422, label: 'Bar' },
      { type: 'rect', x: 6, y: 5, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 9, y: 5, w: 1, h: 1, color: 0x443322, label: 'Table' },
      { type: 'rect', x: 11, y: 3, w: 1, h: 2, color: 0x443322, label: 'Barrels' },
    ],
    counterY: 1,
  },

  // ═══════ VOLCANIC ISLES — Tropical huts ═══════
  volcanic_inn: {
    id: 'volcanic_inn', name: 'The Ember Rest', zone: 'volcanic_isles',
    size: { w: 14, h: 10 },
    floorColor: 0x8a7a5a, wallColor: 0x3a3030, accentColor: 0x6a5a4a,
    npc: { name: 'Innkeeper Kai', tint: 0xff8844, key: 'npc_elder',
      dialogue: ['The heat never stops, but neither does the hospitality.', 'Rest here. The lava flows wait for no one.'],
      action: 'inn' },
    furniture: [
      { type: 'rect', x: 2, y: 2, w: 2, h: 1, color: 0x7a6a4a, label: 'Hammock' },
      { type: 'rect', x: 10, y: 2, w: 2, h: 1, color: 0x7a6a4a, label: 'Hammock' },
      { type: 'rect', x: 6, y: 4, w: 2, h: 1, color: 0x886644, label: 'Table' },
      { type: 'rect', x: 1, y: 7, w: 1, h: 1, color: 0xcc6622, label: 'Torch' },
      { type: 'rect', x: 12, y: 7, w: 1, h: 1, color: 0xcc6622, label: 'Torch' },
    ],
    counterY: 1,
    exitDoor: { x: 7, y: 9 },
  },

  volcanic_forge: {
    id: 'volcanic_forge', name: 'Magma Works', zone: 'volcanic_isles',
    size: { w: 12, h: 9 },
    floorColor: 0x5a4040, wallColor: 0x2a1818, accentColor: 0x6a3a2a,
    npc: { name: 'Forgemaster Blaze', tint: 0xff4422, key: 'npc_knight',
      dialogue: ['The volcano gives us fire. I give it purpose.', 'Volcanic steel is the strongest in the world. Bring me ore.'],
      action: 'workshop' },
    furniture: [
      { type: 'rect', x: 2, y: 3, w: 1, h: 1, color: 0xcc4400, label: 'Lava Forge' },
      { type: 'rect', x: 4, y: 3, w: 1, h: 1, color: 0x884422, label: 'Anvil' },
      { type: 'rect', x: 8, y: 5, w: 2, h: 1, color: 0x554433, label: 'Workbench' },
    ],
    counterY: 1,
  },

  volcanic_arena: {
    id: 'volcanic_arena', name: 'The Crucible', zone: 'volcanic_isles',
    size: { w: 14, h: 10 },
    floorColor: 0x6a5040, wallColor: 0x3a2020, accentColor: 0x884422,
    npc: { name: 'Champion Pyrra', tint: 0xff6644, key: 'npc_knight',
      dialogue: ['In the Crucible, only the strong survive.', 'The heat separates the brave from the foolish.'],
      action: 'arena' },
    furniture: [
      { type: 'rect', x: 4, y: 3, w: 6, h: 4, color: 0x553322, label: 'Lava Ring' },
      { type: 'rect', x: 2, y: 4, w: 1, h: 1, color: 0xcc4400, label: 'Fire Pit' },
      { type: 'rect', x: 11, y: 4, w: 1, h: 1, color: 0xcc4400, label: 'Fire Pit' },
    ],
    counterY: 1,
  },

  // ═══════ DARK CASTLE — Gothic chambers ═══════
  dark_throne: {
    id: 'dark_throne', name: 'The Antechamber', zone: 'dark_castle',
    size: { w: 16, h: 12 },
    floorColor: 0x3a2a3a, wallColor: 0x1a1020, accentColor: 0x4a3a4a,
    npc: { name: 'Shadow Warden', tint: 0x8844aa, key: 'npc_knight',
      dialogue: ['None pass beyond these doors without proving their worth.', 'The darkness tests all who enter. Are you ready?'],
      action: 'cantina' },
    furniture: [
      { type: 'rect', x: 7, y: 2, w: 2, h: 2, color: 0x2a1a2a, label: 'Throne' },
      { type: 'rect', x: 3, y: 5, w: 1, h: 1, color: 0x5533aa, label: 'Crystal' },
      { type: 'rect', x: 12, y: 5, w: 1, h: 1, color: 0x5533aa, label: 'Crystal' },
      { type: 'rect', x: 5, y: 8, w: 1, h: 1, color: 0x332244, label: 'Pedestal' },
      { type: 'rect', x: 10, y: 8, w: 1, h: 1, color: 0x332244, label: 'Pedestal' },
    ],
    counterY: 2,
    exitDoor: { x: 8, y: 11 },
  },

  dark_merchant: {
    id: 'dark_merchant', name: 'The Shadow Market', zone: 'dark_castle',
    size: { w: 12, h: 9 },
    floorColor: 0x2a2030, wallColor: 0x1a1018, accentColor: 0x3a2a3a,
    npc: { name: 'Cursed Scholar', tint: 0xaa66cc, key: 'npc_elder',
      dialogue: ['Knowledge has a price. Everything here does.', 'The castle holds secrets older than memory itself.'],
      action: 'shop' },
    furniture: [
      { type: 'rect', x: 2, y: 3, w: 1, h: 1, color: 0x221122, label: 'Tome' },
      { type: 'rect', x: 3, y: 3, w: 1, h: 1, color: 0x221122, label: 'Tome' },
      { type: 'rect', x: 8, y: 4, w: 2, h: 1, color: 0x332233, label: 'Display' },
      { type: 'rect', x: 5, y: 6, w: 2, h: 1, color: 0x1a1018, label: 'Chest' },
    ],
    counterY: 1,
  },

  dark_dungeons: {
    id: 'dark_dungeons', name: 'The Undercrypt', zone: 'dark_castle',
    size: { w: 12, h: 9 },
    floorColor: 0x2a2030, wallColor: 0x1a1020, accentColor: 0x3a2a3a,
    npc: { name: 'Dungeon Keeper Vex', tint: 0x553355, key: 'npc_knight',
      dialogue: ['The dungeons below hold treasures... and terrors.', 'Only the strongest return from the deep.'],
      action: 'dungeons' },
    furniture: [
      { type: 'rect', x: 2, y: 4, w: 1, h: 1, color: 0x1a1018, label: 'Chest' },
      { type: 'rect', x: 9, y: 4, w: 1, h: 1, color: 0x1a1018, label: 'Chest' },
      { type: 'rect', x: 5, y: 5, w: 2, h: 2, color: 0x332233, label: 'Stairs Down' },
    ],
    counterY: 1,
  },
};
