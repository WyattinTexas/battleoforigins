// CRAFTING
// Crafting — schematics, essences, workshop, assembly, experimentation
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ CRAFTING SCHEMATICS ═══════
// Equipment slots: weapon, head (armor), accessory
// Tiers: common (1 essence), rare (2 essences), legendary (3+ essences)
const SCHEMATICS = [
  // ── ORIGINAL SCHEMATICS ──
  // Weapons: potency 0.45, stability 0.1, resonance 0.35, purity 0.1
  // Armor/Head: potency 0.1, stability 0.45, resonance 0.1, purity 0.35
  // Accessories: potency 0.2, stability 0.2, resonance 0.3, purity 0.3
  // Spirit Traps: potency 0.1, stability 0.3, resonance 0.2, purity 0.4
  { id: 'frost_blaster', name: 'Frost Blaster', type: 'weapon', slot: 'weapon', essencesNeeded: 2, desc: '+1 damage on winning rolls', basePower: 3, icon: '🔫', tier: 'rare', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },
  { id: 'ice_shield', name: 'Ice Shield', type: 'armor', slot: 'head', essencesNeeded: 2, desc: '-1 damage taken from doubles', basePower: 2, icon: '🛡️', tier: 'rare', weights: { potency: 0.1, stability: 0.45, resonance: 0.1, purity: 0.35 } },
  { id: 'spirit_lens', name: 'Spirit Lens', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Reveals enemy stats before battle', basePower: 1, icon: '🔮', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'spirit_bow', name: 'Spirit Bow', type: 'weapon', slot: 'weapon', essencesNeeded: 2, desc: '+1 die on first roll each battle', basePower: 3, icon: '🏹', tier: 'rare', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },
  { id: 'warden_cloak', name: 'Warden Cloak', type: 'armor', slot: 'head', essencesNeeded: 3, desc: 'Reduce all damage by 1', basePower: 4, icon: '🧥', tier: 'legendary', weights: { potency: 0.1, stability: 0.45, resonance: 0.1, purity: 0.35 } },
  { id: 'healers_staff', name: "Healer's Staff", type: 'accessory', slot: 'accessory', essencesNeeded: 2, desc: 'Heal 1 HP after each winning roll', basePower: 3, icon: '🪄', tier: 'rare', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'frostfire_blade', name: 'Frostfire Blade', type: 'weapon', slot: 'weapon', essencesNeeded: 3, desc: '+2 damage, Ice Shards deal double', basePower: 5, icon: '⚔️', tier: 'legendary', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },

  // ── BLADES (weapon slot) — from Multiplayer ──
  { id: 'ice_blade', name: 'Ice Blade', type: 'weapon', slot: 'weapon', essencesNeeded: 2, desc: '+1 die while swinging. Wins grant +1 Ice Shard.', basePower: 4, icon: '🗡️', tier: 'rare', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },
  { id: 'flame_blade', name: 'Flame Blade', type: 'weapon', slot: 'weapon', essencesNeeded: 2, desc: '+1 die while swinging. Wins generate +5 Burn.', basePower: 4, icon: '🔥', tier: 'rare', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },

  // ── MASKS (head slot) — from Multiplayer ──
  { id: 'mask_of_day', name: 'Mask of Day', type: 'armor', slot: 'head', essencesNeeded: 2, desc: 'Gain 1 Burn for each 1 or 2 you roll.', basePower: 3, icon: '🌅', tier: 'rare', weights: { potency: 0.1, stability: 0.45, resonance: 0.1, purity: 0.35 } },
  { id: 'mask_of_night', name: 'Mask of Night', type: 'armor', slot: 'head', essencesNeeded: 2, desc: 'Roll same dice as enemy +1. +1 damage on wins.', basePower: 4, icon: '🌙', tier: 'rare', weights: { potency: 0.1, stability: 0.45, resonance: 0.1, purity: 0.35 } },

  // ── CHARMS (accessory slot) — from Multiplayer ──
  { id: 'lucky_charm', name: 'Lucky Charm', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Start each fight with 1 Lucky Stone.', basePower: 2, icon: '🍀', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'healing_root', name: 'Healing Root', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Start each fight with 1 Healing Seed.', basePower: 2, icon: '🌿', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'ember_stone', name: 'Ember Stone', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Start each fight with 1 Sacred Fire.', basePower: 2, icon: '🔶', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'frost_shard_charm', name: 'Frost Shard', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Start each fight with 1 Ice Shard.', basePower: 2, icon: '❄️', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'surge_crystal', name: 'Surge Crystal', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Start each fight with 1 Surge.', basePower: 2, icon: '⚡', tier: 'common', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'firefly_lantern', name: 'Firefly Lantern', type: 'accessory', slot: 'accessory', essencesNeeded: 2, desc: 'Start each fight with 1 Magic Firefly. Take 2 damage.', basePower: 3, icon: '🏮', tier: 'rare', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },

  // ── SPIRIT TRAPS ──
  { id: 'spirit_trap', name: 'Spirit Trap', type: 'accessory', slot: 'accessory', essencesNeeded: 1, desc: 'Place in a zone to passively collect essences over time.', basePower: 2, icon: '🪤', tier: 'common', weights: { potency: 0.1, stability: 0.3, resonance: 0.2, purity: 0.4 } },
  { id: 'spirit_trap_adv', name: 'Advanced Spirit Trap', type: 'accessory', slot: 'accessory', essencesNeeded: 2, desc: 'Collects higher quality essences passively.', basePower: 3, icon: '⚡', tier: 'rare', weights: { potency: 0.1, stability: 0.3, resonance: 0.2, purity: 0.4 } },

  // ── LEGENDARY GEAR — from Multiplayer ──
  { id: 'moonstone_ring', name: 'Moonstone Ring', type: 'accessory', slot: 'accessory', essencesNeeded: 3, desc: 'Start each fight with 1 Moonstone.', basePower: 5, icon: '💎', tier: 'legendary', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },
  { id: 'golden_dice', name: 'Golden Dice', type: 'weapon', slot: 'weapon', essencesNeeded: 3, desc: '+1 die on your first roll of every fight.', basePower: 5, icon: '🎲', tier: 'legendary', weights: { potency: 0.45, stability: 0.1, resonance: 0.35, purity: 0.1 } },
  { id: 'shades_cape', name: "Shade's Cape", type: 'armor', slot: 'head', essencesNeeded: 3, desc: 'Your active ghost gains +1 max HP.', basePower: 5, icon: '👑', tier: 'legendary', weights: { potency: 0.1, stability: 0.45, resonance: 0.1, purity: 0.35 } },
  { id: 'valkins_crystal', name: "Valkin's Crystal", type: 'accessory', slot: 'accessory', essencesNeeded: 3, desc: 'Doubles deal +1 bonus damage.', basePower: 5, icon: '💀', tier: 'legendary', weights: { potency: 0.2, stability: 0.2, resonance: 0.3, purity: 0.3 } },

  // ── SUB-COMPONENTS (intermediate crafting items) ──
  { id: 'frost_infusion', name: 'Frost Infusion', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Ice-infused component. Blacksmiths use this to enhance armor.', basePower: 0, icon: '❄️', tier: 'rare', weights: { potency:0.1, stability:0.3, resonance:0.2, purity:0.4 }, requiresSkill: 'fm_1', requiresMaterial: { frozen_crystal: 1, frost_shard: 2 } },
  { id: 'flame_core', name: 'Flame Core', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Fire-infused component. Blacksmiths use this to enhance armor.', basePower: 0, icon: '🔥', tier: 'rare', weights: { potency:0.3, stability:0.1, resonance:0.4, purity:0.2 }, requiresSkill: 'flm_1', requiresMaterial: { volcanic_glass: 1, ember_dust: 2 } },
  { id: 'enchantment', name: 'Spirit Enchantment', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Magical enchantment. Blacksmiths use this to enhance gear.', basePower: 0, icon: '✨', tier: 'rare', weights: { potency:0.2, stability:0.2, resonance:0.3, purity:0.3 }, requiresSkill: 'cc_2', requiresMaterial: { spirit_thread: 2, essence_fragment: 1 } },
  { id: 'mask_core', name: 'Mask Core', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Shaped mask base. Mask Makers finish these, or Blacksmiths set them.', basePower: 0, icon: '🎭', tier: 'rare', weights: { potency:0.15, stability:0.15, resonance:0.35, purity:0.35 }, requiresSkill: 'mm_2', requiresMaterial: { mask_fragment: 2, crystal_chip: 1 } },
  { id: 'iron_frame', name: 'Iron Frame', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Sturdy base frame for weapons and armor.', basePower: 0, icon: '🔩', tier: 'common', weights: { potency:0.3, stability:0.4, resonance:0.1, purity:0.2 }, requiresSkill: 'bs_1', requiresMaterial: { iron_ore: 2 } },
  { id: 'ancient_stock', name: 'Ancient Stock', type: 'component', slot: 'none', essencesNeeded: 1, desc: 'Polished ancient wood stock for blasters.', basePower: 0, icon: '🪵', tier: 'common', weights: { potency:0.2, stability:0.3, resonance:0.2, purity:0.3 }, requiresSkill: 'be_1', requiresMaterial: { ancient_wood: 2 } },
];

// ═══════ SPIRIT ESSENCE (Resource Quality System) ═══════

// ═══════ ESSENCE SUBTYPES ═══════
const ZONE_ESSENCE_SUBTYPES = {
  'Crystal Glade': { subtype: 'Crystal', bonusStat: 'resonance', bonusAmount: 100 },
  'Frozen Hollow': { subtype: 'Frost', bonusStat: 'stability', bonusAmount: 100 },
  'Aurora Fields': { subtype: 'Aurora', bonusStat: 'purity', bonusAmount: 100 },
  'Shimmer Basin': { subtype: 'Shimmer', bonusStat: 'potency', bonusAmount: 100 },
  'Permafrost Depths': { subtype: 'Permafrost', bonusStat: ['stability','potency'], bonusAmount: 100 },
  'Sunlit Meadow': { subtype: 'Sun', bonusStat: ['resonance','purity'], bonusAmount: 100 },
  'Bramble Thicket': { subtype: 'Bramble', bonusStat: 'potency', bonusAmount: 100 },
  'Magma Pools': { subtype: 'Magma', bonusStat: ['potency','resonance'], bonusAmount: 100 },
  'Obsidian Fields': { subtype: 'Obsidian', bonusStat: ['stability','purity'], bonusAmount: 100 },
};

function generateEssence(card, zoneIdx) {
  // Quality influenced by rarity + discipline + zone quality
  const rarityBonus = { common: 0, uncommon: 100, rare: 200, 'ghost-rare': 350, legendary: 500 }[card.rarity] || 0;
  const scoutBonus = G.discipline === 'scout' ? 100 : 0;

  // Zone quality multiplier
  let zoneMultiplier = 1.0;
  if (zoneIdx >= 0) {
    const cycleId = getZoneCycleId();
    zoneMultiplier = getZoneQuality(zoneIdx, cycleId);
  }

  const zoneName = zoneIdx >= 0 ? ENCOUNTER_ZONES[zoneIdx].name : (Math.floor(G.x) > 88 && Math.floor(G.y) < 42 ? 'Dark Castle' : Math.floor(G.x) > 60 ? 'Volcanic Isles' : Math.floor(G.y) >= 45 ? 'Rolling Hills' : 'Frost Valley');
  const subtypeInfo = ZONE_ESSENCE_SUBTYPES[zoneName];
  const subtypeName = subtypeInfo ? subtypeInfo.subtype : '';

  function stat(statName) {
    let bonus = 0;
    if (subtypeInfo) {
      const bs = subtypeInfo.bonusStat;
      if (Array.isArray(bs)) {
        if (bs.includes(statName)) bonus = subtypeInfo.bonusAmount;
      } else if (bs === statName) {
        bonus = subtypeInfo.bonusAmount;
      }
    }
    const worldEventBonus = isWorldEventActive('essenceBonus') ? 200 : 0;
    const base = Math.min(1000, Math.max(1, Math.floor(Math.random() * 600) + rarityBonus + scoutBonus + Math.floor(Math.random() * 200) + bonus + worldEventBonus));
    return Math.min(1000, Math.max(1, Math.floor(base * zoneMultiplier)));
  }

  const essenceName = subtypeName ? `${subtypeName} ${card.name} Essence` : `${card.name} Essence`;

  return {
    id: Date.now() + Math.random(),
    name: essenceName,
    subtype: subtypeName,
    fromCard: card.id,
    fromName: card.name,
    region: zoneName,
    rarity: card.rarity,
    potency: stat('potency'),
    stability: stat('stability'),
    resonance: stat('resonance'),
    purity: stat('purity'),
    timestamp: Date.now(),
  };
}

// ═══════ CRAFTING SYSTEM ═══════

let craftState = { selectedEssences: [], schematic: SCHEMATICS[0], experimentPoints: 0 };

function isNearWorkshop() {
  const tileX = Math.floor(G.x);
  const tileY = Math.floor(G.y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (worldMap[tileY+dy]?.[tileX+dx] === 8) return true;
  }
  return false;
}


function openCrafting() {
  // Check if near workshop (Journeyman can craft commons anywhere)
  const nearWorkshop = isNearWorkshop();
  if (!nearWorkshop && !hasSkill('tnk_3')) {
    notify('Find a workshop in the hub town to craft!');
    return;
  }
  if (G.essences.length < 1) {
    notify('You need Spirit Essences to craft. Battle wild Spiritkin!');
    return;
  }

  craftQuickMode = false;
  const masteryType = SCHEMATICS[0].type;
  const masteryXp = G.mastery[masteryType]?.xp || 0;
  const masteryLvl = getMasteryLevel(masteryXp);
  const baseExp = G.discipline === 'artificer' ? 3 : 1;
  const tnkBonus = hasSkill('tnk_1') ? 1 : 0; // Apprentice: +1 experiment point
  craftState = { selectedEssences: [], schematic: SCHEMATICS[0], experimentPoints: baseExp + masteryLvl + tnkBonus };
  renderCraftUI();
  document.getElementById('craftOverlay').classList.add('active');
}

function renderCraftUI() {
  const needed = craftState.schematic.essencesNeeded;
  const tierColor = { common: '#8b95a5', rare: '#3498db', legendary: '#f39c12' };

  // ── LEFT PANEL: Schematic cards grouped by slot ──
  const slotsEl = document.getElementById('craftSlots');
  const slotGroups = { weapon: [], head: [], accessory: [], none: [] };
  const nearWS = isNearWorkshop();
  for (const s of SCHEMATICS) {
    // Craft location rules: quick mode = common only; not near workshop = common only
    if (craftQuickMode && s.tier !== 'common') continue;
    if (!nearWS && s.tier !== 'common') continue;
    (slotGroups[s.slot || s.type] || slotGroups.accessory).push(s);
  }

  let leftHtml = '';
  for (const [slot, items] of Object.entries(slotGroups)) {
    if (!items.length) continue;
    const slotIcon = slot === 'weapon' ? '<span class="gi gi-sword"></span>' : slot === 'head' ? '<span class="gi gi-shield"></span>' : slot === 'none' ? '<span class="gi gi-wrench"></span>' : '<span class="gi gi-ring"></span>';
    const slotLabel = slot === 'none' ? 'Components' : slot;
    leftHtml += `<div class="cw-section-label" style="margin-top:12px;">${slotIcon} ${slotLabel}</div>`;
    for (const s of items) {
      const sel = s.id === craftState.schematic.id;
      const tc = tierColor[s.tier] || '#888';
      const mxp = G.mastery[s.type]?.xp || 0;
      const mInfo = getMasteryInfo(mxp);
      const isLegendaryLocked = s.tier === 'legendary' && getMasteryLevel(mxp) < 3;
      leftHtml += `<div class="cw-schem-card ${sel ? 'selected' : ''}${isLegendaryLocked ? ' locked' : ''}" onclick="selectSchematic('${s.id}')" style="${isLegendaryLocked ? 'opacity:0.5;' : ''}">
        <div class="cw-schem-icon">${s.icon || '?'}</div>
        <div class="cw-schem-info">
          <div class="cw-schem-name">${s.name}${isLegendaryLocked ? ' 🔒' : ''}</div>
          <div class="cw-schem-desc">${isLegendaryLocked ? 'Requires Journeyman mastery' : s.desc}</div>
          <div class="cw-schem-meta">
            <span class="cw-schem-tag ${s.tier}">${s.tier}</span>
            <span class="cw-schem-tag" style="color:#666;">${s.essencesNeeded} essence${s.essencesNeeded > 1 ? 's' : ''}</span>
            <span class="cw-schem-tag" style="color:${mInfo.cls === 'master' ? '#f8c' : '#666'};">${mInfo.name}</span>
          </div>
        </div>
      </div>`;
    }
  }
  slotsEl.innerHTML = leftHtml;

  // ── RIGHT PANEL: Selected schematic + essence slots + essence list ──
  const sel = craftState.schematic;
  const tc = tierColor[sel.tier] || '#888';
  const masteryXp = G.mastery[sel.type]?.xp || 0;
  const masteryInfo = getMasteryInfo(masteryXp);

  // Selected schematic display — show stat weights so player knows what matters
  const selWeights = sel.weights || { potency: 0.25, stability: 0.25, resonance: 0.25, purity: 0.25 };
  const weightLabels = [
    { name: 'P', val: selWeights.potency },
    { name: 'S', val: selWeights.stability },
    { name: 'R', val: selWeights.resonance },
    { name: 'U', val: selWeights.purity },
  ].sort((a, b) => b.val - a.val);
  const weightStr = weightLabels.map(w => {
    const pct = Math.floor(w.val * 100);
    const color = pct >= 40 ? '#4fc878' : pct >= 25 ? '#c8b040' : '#666';
    return `<span style="color:${color}">${w.name}:${pct}%</span>`;
  }).join(' ');

  // Material & skill requirements display
  let matReqHtml = '';
  if (sel.requiresMaterial) {
    const matNames = { frost_shard:'Frost Shard', ember_dust:'Ember Dust', spirit_thread:'Spirit Thread', mask_fragment:'Mask Fragment', iron_ore:'Iron Ore', volcanic_glass:'Volcanic Glass', frozen_crystal:'Frozen Crystal', ancient_wood:'Ancient Wood', essence_fragment:'Essence Fragment', crystal_chip:'Crystal Chip', glow_mote:'Glow Mote', spirit_dust:'Spirit Dust' };
    matReqHtml = '<div style="margin-top:6px;font-size:11px;">';
    for (const [matId, qty] of Object.entries(sel.requiresMaterial)) {
      const have = G.materials?.[matId] || 0;
      const ok = have >= qty;
      matReqHtml += `<span style="color:${ok ? '#4a8' : '#a44'};">${matNames[matId] || matId}: ${have}/${qty} ${ok ? '✓' : '✗'}</span> `;
    }
    matReqHtml += '</div>';
  }
  if (sel.requiresSkill) {
    const skillOk = hasSkill(sel.requiresSkill);
    matReqHtml += `<div style="font-size:11px;color:${skillOk ? '#4a8' : '#a44'};">Skill: ${sel.requiresSkill} ${skillOk ? '✓' : '🔒'}</div>`;
  }

  document.getElementById('cwSelectedSchematic').innerHTML = `
    <div class="cw-sel-icon">${sel.icon || '?'}</div>
    <div class="cw-sel-name" style="color:${tc};">${sel.name}</div>
    <div class="cw-sel-desc">${sel.desc}</div>
    <div class="cw-sel-slots">Needs ${sel.essencesNeeded} essence${sel.essencesNeeded > 1 ? 's' : ''} &bull; Slot: ${sel.slot || sel.type} &bull; Mastery: ${masteryInfo.name}</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">Stat Weights: ${weightStr}</div>
    ${matReqHtml}
  `;

  // Essence slots
  const essSlotsEl = document.getElementById('cwEssenceSlots');
  let slotHtml = '';
  for (let i = 0; i < needed; i++) {
    const ess = craftState.selectedEssences[i];
    if (ess) {
      slotHtml += `<div class="cw-essence-slot filled" onclick="removeCraftEssence(${i})">
        <span><strong>${ess.name}</strong><br>
        <span style="font-size:10px;color:#888;">P:${ess.potency} S:${ess.stability} R:${ess.resonance} U:${ess.purity}</span></span>
        <span class="ess-remove">X</span>
      </div>`;
    } else {
      slotHtml += `<div class="cw-essence-slot">Tap an essence below to fill slot ${i + 1}</div>`;
    }
  }
  essSlotsEl.innerHTML = slotHtml;

  // Available essences
  const essListEl = document.getElementById('cwEssenceList');
  if (G.essences.length === 0) {
    essListEl.innerHTML = '<div style="color:#555;font-size:12px;padding:8px;">No essences. Battle wild Spiritkin to collect!</div>';
  } else {
    function qc(v) { return v > 700 ? 'high' : v > 400 ? 'mid' : 'low'; }
    essListEl.innerHTML = G.essences.filter(e => !craftState.selectedEssences.includes(e)).map(ess => `
      <div class="cw-ess-item" onclick="addCraftEssence('${ess.id}')">
        <span class="ess-name">${ess.name}</span>
        <span class="ess-stats">
          P:<span class="cw-ess-stat-val ${qc(ess.potency)}">${ess.potency}</span>
          S:<span class="cw-ess-stat-val ${qc(ess.stability)}">${ess.stability}</span>
          R:<span class="cw-ess-stat-val ${qc(ess.resonance)}">${ess.resonance}</span>
          U:<span class="cw-ess-stat-val ${qc(ess.purity)}">${ess.purity}</span>
        </span>
      </div>
    `).join('');
  }

  // Enable craft button
  document.getElementById('btnCraft').disabled = craftState.selectedEssences.length < needed;

  // Experiment preview (old bar — keep hidden, replaced by output preview)
  const previewEl = document.getElementById('craftPreview');
  if (craftState.selectedEssences.length >= needed) {
    previewEl.style.display = 'block';
    document.getElementById('expFill').style.width = Math.min(100, craftState.experimentPoints * 15) + '%';
    document.getElementById('expText').textContent = `Experiment Points: ${craftState.experimentPoints} | Mastery: ${masteryInfo.name} (${masteryXp} XP)`;
  } else {
    previewEl.style.display = 'none';
  }
  document.getElementById('craftResult').style.display = 'none';

  // Live output preview
  updateCraftPreview();
}

function selectSchematic(id) {
  const schem = SCHEMATICS.find(s => s.id === id) || SCHEMATICS[0];

  // Legendary tier: requires Journeyman mastery (level 3+)
  if (schem.tier === 'legendary') {
    const mxp = G.mastery[schem.type]?.xp || 0;
    const mlvl = getMasteryLevel(mxp);
    if (mlvl < 3) {
      notify(`Requires Journeyman mastery in ${schem.type} to craft legendary items.`);
      return;
    }
  }

  craftState.schematic = schem;
  craftState.selectedEssences = [];
  // Recalculate experiment points based on mastery for new schematic type
  const masteryType = craftState.schematic.type;
  const masteryXp = G.mastery[masteryType]?.xp || 0;
  const masteryLvl = getMasteryLevel(masteryXp);
  const baseExp = G.discipline === 'artificer' ? 3 : 1;
  const tnkBonus2 = hasSkill('tnk_1') ? 1 : 0; // Apprentice: +1 experiment point
  craftState.experimentPoints = baseExp + masteryLvl + tnkBonus2;
  renderCraftUI();
}

function addCraftEssence(essId) {
  const ess = G.essences.find(e => String(e.id) === String(essId));
  if (!ess || craftState.selectedEssences.length >= craftState.schematic.essencesNeeded) return;
  craftState.selectedEssences.push(ess);
  renderCraftUI();
}

function removeCraftEssence(idx) {
  craftState.selectedEssences.splice(idx, 1);
  renderCraftUI();
}

function showEssencePicker(slot) {
  // Handled by clicking available essences below
}

// ═══════ LIVE CRAFT OUTPUT PREVIEW ═══════

function updateCraftPreview() {
  const previewEl = document.getElementById('cwOutputPreview');
  const schem = craftState.schematic;
  const essences = craftState.selectedEssences;
  const needed = schem.essencesNeeded;

  if (essences.length === 0) {
    previewEl.style.display = 'none';
    return;
  }

  previewEl.style.display = 'block';
  const w = schem.weights || { potency: 0.25, stability: 0.25, resonance: 0.25, purity: 0.25 };

  const avgP = essences.reduce((s, e) => s + e.potency, 0) / essences.length;
  const avgS = essences.reduce((s, e) => s + e.stability, 0) / essences.length;
  const avgR = essences.reduce((s, e) => s + e.resonance, 0) / essences.length;
  const avgU = essences.reduce((s, e) => s + e.purity, 0) / essences.length;

  // Weighted quality
  let quality = Math.floor(avgP * w.potency + avgS * w.stability + avgR * w.resonance + avgU * w.purity);

  // Guild crafting bonus in preview
  const previewGuildBonus = (typeof getGuildCraftBonus === 'function') ? getGuildCraftBonus() : 0;
  quality += previewGuildBonus;

  // Individual stat contributions
  const contributions = [
    { name: 'Potency', val: avgP, weight: w.potency, contrib: Math.floor(avgP * w.potency) },
    { name: 'Stability', val: avgS, weight: w.stability, contrib: Math.floor(avgS * w.stability) },
    { name: 'Resonance', val: avgR, weight: w.resonance, contrib: Math.floor(avgR * w.resonance) },
    { name: 'Purity', val: avgU, weight: w.purity, contrib: Math.floor(avgU * w.purity) },
  ];

  // Derived stats
  const damage = schem.type === 'weapon' ? Math.floor(quality / 300) + 1 : 0;
  const defense = schem.type === 'armor' ? Math.floor(quality / 400) + 1 : 0;
  const qualityTier = quality > 600 ? 'Mastercraft' : quality > 400 ? 'Superior' : quality > 200 ? 'Standard' : 'Basic';
  const qualityColor = quality > 600 ? '#4fc878' : quality > 400 ? '#c8b040' : quality > 200 ? '#c89040' : '#c85040';
  const qualityPct = Math.min(100, Math.floor(quality / 8));

  // Find best/worst stat match
  const sorted = [...contributions].sort((a, b) => (b.val * b.weight) - (a.val * a.weight));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  function matchClass(contrib) { return contrib > 200 ? 'good' : contrib > 100 ? 'okay' : 'poor'; }

  let html = `<div class="preview-title">Projected Output <span style="font-size:9px;color:#444;">(click to collapse)</span></div>`;

  // Show derived combat stats
  if (damage > 0) html += `<div style="text-align:center;font-size:14px;color:#f44a4a;margin-bottom:6px;">Damage: +${damage}</div>`;
  if (defense > 0) html += `<div style="text-align:center;font-size:14px;color:#4ac8f4;margin-bottom:6px;">Defense: +${defense}</div>`;

  // Stat contribution bars
  for (const c of contributions) {
    const pct = Math.min(100, Math.floor(c.contrib / 3));
    const cls = matchClass(c.contrib);
    const weightLabel = c.weight >= 0.4 ? ' (primary)' : c.weight >= 0.25 ? '' : ' (minor)';
    html += `<div class="preview-stat-row">
      <span class="preview-stat-label">${c.name}${weightLabel}</span>
      <div class="preview-stat-bar-outer"><div class="preview-stat-bar ${cls}" style="width:${pct}%"></div></div>
      <span class="preview-stat-value" style="color:${cls === 'good' ? '#4fc878' : cls === 'okay' ? '#c8b040' : '#c85040'}">${c.contrib}</span>
    </div>`;
  }

  // Quality bar
  html += `<div class="preview-quality-row">
    <span class="preview-quality-label">Quality</span>
    <div style="flex:1;margin:0 10px;">
      <div class="preview-stat-bar-outer" style="height:10px;"><div class="preview-stat-bar" style="width:${qualityPct}%;background:linear-gradient(90deg, #c85040, #c8b040, #4fc878);"></div></div>
    </div>
    <span class="preview-quality-value" style="color:${qualityColor}">${quality} ${qualityTier}</span>
  </div>`;

  // Guild bonus display
  if (previewGuildBonus > 0) {
    html += `<div style="text-align:center;font-size:11px;color:#4fc878;margin-bottom:4px;">Guild Bonus: +${previewGuildBonus} Quality</div>`;
  }

  // Best/worst match
  html += `<div class="preview-match-row">
    <span class="good-match">Best: ${best.name} (${Math.floor(best.weight * 100)}% weight, ${Math.floor(best.val)} avg)</span>
    &nbsp;|&nbsp;
    <span class="poor-match">Weakest: ${worst.name} (${Math.floor(worst.weight * 100)}% weight, ${Math.floor(worst.val)} avg)</span>
  </div>`;

  if (essences.length < needed) {
    html += `<div style="text-align:center;font-size:10px;color:#666;margin-top:6px;">Add ${needed - essences.length} more essence${needed - essences.length > 1 ? 's' : ''} for final stats</div>`;
  }

  previewEl.innerHTML = html;
}

// ═══════ ASSEMBLY + DIRECTED EXPERIMENTATION SYSTEM ═══════

let expState = null;

function doCraft() {
  const essences = craftState.selectedEssences;
  const schem = craftState.schematic;
  if (essences.length < schem.essencesNeeded) return;

  // Journeyman: can craft commons anywhere, but rare+ still needs workshop
  if (!isNearWorkshop() && hasSkill('tnk_3') && schem.tier !== 'common') {
    notify('Rare+ schematics still require a workshop!');
    return;
  }

  // Check material requirements
  if (schem.requiresMaterial) {
    for (const [matId, qty] of Object.entries(schem.requiresMaterial)) {
      if ((G.materials?.[matId] || 0) < qty) {
        const matNames = {
          frozen_crystal:'Frozen Crystal', frost_shard:'Frost Shard', volcanic_glass:'Volcanic Glass',
          ember_dust:'Ember Dust', spirit_thread:'Spirit Thread', essence_fragment:'Essence Fragment',
          mask_fragment:'Mask Fragment', crystal_chip:'Crystal Chip', iron_ore:'Iron Ore',
          ancient_wood:'Ancient Wood', glow_mote:'Glow Mote', spirit_dust:'Spirit Dust',
        };
        notify(`Need ${qty} ${matNames[matId] || matId}! (Have ${G.materials?.[matId] || 0})`);
        return;
      }
    }
    // Consume materials
    for (const [matId, qty] of Object.entries(schem.requiresMaterial)) {
      G.materials[matId] -= qty;
    }
  }

  // Check skill requirement
  if (schem.requiresSkill && !hasSkill(schem.requiresSkill)) {
    notify(`Requires skill: ${schem.requiresSkill}. Check your profession tree!`);
    return;
  }

  // Calculate base stats from essences using WEIGHTED average
  const w = schem.weights || { potency: 0.25, stability: 0.25, resonance: 0.25, purity: 0.25 };
  const avgPotency = essences.reduce((s, e) => s + e.potency, 0) / essences.length;
  const avgStability = essences.reduce((s, e) => s + e.stability, 0) / essences.length;
  const avgResonance = essences.reduce((s, e) => s + e.resonance, 0) / essences.length;
  const avgPurity = essences.reduce((s, e) => s + e.purity, 0) / essences.length;

  // Weighted quality calculation
  const weightedQuality = Math.floor(avgPotency * w.potency + avgStability * w.stability + avgResonance * w.resonance + avgPurity * w.purity);

  // Mastery quality floor
  const masteryType = schem.type;
  const masteryXp = G.mastery[masteryType]?.xp || 0;
  const masteryLvl = getMasteryLevel(masteryXp);
  const qualityFloor = masteryLvl * 50;

  // Guild crafting bonus
  const guildBonus = (typeof getGuildCraftBonus === 'function') ? getGuildCraftBonus() : 0;

  const baseQuality = Math.max(qualityFloor, weightedQuality) + guildBonus;

  // Set up experiment state
  expState = {
    schem,
    essences: [...essences],
    avgPotency, avgStability, avgResonance, avgPurity,
    masteryLvl,
    pointsLeft: craftState.experimentPoints,
    baseQuality,
    assemblyMod: 0,
    itemDestroyed: false,
    // Directed experiment stat pools
    expDamage: 0,
    expDefense: 0,
    expQuality: 0,
    expSpecial: 0,
    expAttempts: { damage: 0, defense: 0, quality: 0, special: 0 },
  };

  // Show experiment overlay and start ASSEMBLY phase
  document.getElementById('experimentOverlay').classList.add('active');
  startAssemblyPhase();
}

// ═══════ ASSEMBLY PHASE ═══════

function startAssemblyPhase() {
  const content = document.getElementById('expPhaseContent');
  const schem = expState.schem;

  content.innerHTML = `
    <div class="assembly-phase">
      <h2 style="color:#daa520;margin-bottom:4px;">Assembly</h2>
      <p style="font-size:12px;color:#888;margin-bottom:4px;">${schem.icon} ${schem.name}</p>
      <p style="font-size:11px;color:#666;margin-bottom:16px;">Base Quality: ${expState.baseQuality}</p>
      <div class="assembly-spinner spinning" id="assemblySpinner">??</div>
      <div class="assembly-result-text" id="assemblyResultText"></div>
      <p style="font-size:11px;color:#556;" id="assemblyModText"></p>
    </div>
  `;

  // Spinning animation — slow down and stop
  const spinner = document.getElementById('assemblySpinner');
  let speed = 40;
  let elapsed = 0;
  const targetDuration = 1500; // 1.5s total

  function tick() {
    spinner.textContent = Math.floor(Math.random() * 100) + 1;
    elapsed += speed;

    if (elapsed >= targetDuration) {
      // Final roll
      resolveAssembly();
      return;
    }

    // Slow down over time
    speed = 40 + Math.floor((elapsed / targetDuration) * 200);
    setTimeout(tick, speed);
  }

  setTimeout(tick, speed);
}

function resolveAssembly() {
  const roll = Math.floor(Math.random() * 100) + 1;
  const masteryBonus = expState.masteryLvl * 5;
  const assemblerBonus = hasSkill('tnk_2') ? 10 : 0; // Assembler: +10
  const adjustedRoll = Math.min(100, roll + masteryBonus + assemblerBonus);

  const spinner = document.getElementById('assemblySpinner');
  const resultText = document.getElementById('assemblyResultText');
  const modText = document.getElementById('assemblyModText');

  spinner.textContent = roll;
  spinner.classList.remove('spinning');

  let resultClass, resultLabel, qualityMod;

  if (roll === 1) {
    // Critical failure — item destroyed
    resultClass = 'critical';
    resultLabel = 'CRITICAL FAILURE!';
    qualityMod = -9999; // sentinel
    expState.itemDestroyed = true;
  } else if (adjustedRoll > 80) {
    resultClass = 'amazing';
    resultLabel = 'AMAZING ASSEMBLY!';
    qualityMod = 0.15;
  } else if (adjustedRoll > 50) {
    resultClass = 'good';
    resultLabel = 'GOOD ASSEMBLY';
    qualityMod = 0;
  } else if (adjustedRoll > 20) {
    resultClass = 'average';
    resultLabel = 'AVERAGE ASSEMBLY';
    qualityMod = -0.10;
  } else {
    resultClass = 'poor';
    resultLabel = 'POOR ASSEMBLY';
    qualityMod = -0.25;
  }

  spinner.classList.add(resultClass);
  resultText.textContent = resultLabel;
  resultText.classList.add(resultClass);

  if (expState.itemDestroyed) {
    modText.innerHTML = `<span style="color:#f00;">The item shattered during assembly. Essences lost.</span>`;
    // Remove essences and close after delay
    setTimeout(() => {
      for (const ess of craftState.selectedEssences) {
        const idx = G.essences.findIndex(e => e.id === ess.id);
        if (idx >= 0) G.essences.splice(idx, 1);
      }
      notify('Assembly failed catastrophically. Essences lost.');
      document.getElementById('experimentOverlay').classList.remove('active');
      expState = null;
      craftState.selectedEssences = [];
      renderCraftUI();
      saveGame();
    }, 2000);
    return;
  }

  expState.assemblyMod = qualityMod;
  const modifiedQuality = Math.floor(expState.baseQuality * (1 + qualityMod));
  expState.baseQuality = Math.max(1, modifiedQuality);

  if (qualityMod > 0) {
    modText.textContent = `+${Math.floor(qualityMod * 100)}% quality bonus! Base: ${expState.baseQuality}`;
  } else if (qualityMod < 0) {
    modText.textContent = `${Math.floor(qualityMod * 100)}% quality penalty. Base: ${expState.baseQuality}`;
  } else {
    modText.textContent = `No modifier. Base: ${expState.baseQuality}`;
  }

  if (masteryBonus > 0) {
    modText.textContent += ` (roll ${roll} +${masteryBonus} mastery = ${adjustedRoll})`;
  }

  // Transition to directed experimentation after a brief pause
  setTimeout(() => {
    startDirectedExperimentation();
  }, 1800);
}

// ═══════ DIRECTED EXPERIMENTATION PHASE ═══════

function startDirectedExperimentation() {
  renderDirectedExperimentation();
}

function renderDirectedExperimentation() {
  const content = document.getElementById('expPhaseContent');
  const schem = expState.schem;
  const pts = expState.pointsLeft;

  // Calculate current total quality with experiment bonuses
  const currentQuality = Math.max(1, expState.baseQuality + expState.expQuality);

  const stats = [
    { key: 'damage', label: 'Damage', value: expState.expDamage, barClass: 'damage', desc: schem.type === 'weapon' ? 'Increases bonus damage on hits' : 'Adds offensive punch' },
    { key: 'defense', label: 'Defense', value: expState.expDefense, barClass: 'defense', desc: schem.type === 'armor' ? 'Increases damage reduction' : 'Adds survivability' },
    { key: 'quality', label: 'Quality', value: currentQuality, barClass: 'quality', desc: 'Overall item power tier' },
    { key: 'special', label: 'Special', value: expState.expSpecial, barClass: 'special', desc: 'Enhances unique schematic effect' },
  ];

  let html = `<div class="directed-exp-container">
    <div class="directed-exp-header">
      <h2 style="color:#f8c;margin:0 0 4px;">Experimentation</h2>
      <p style="font-size:12px;color:#888;">${schem.icon} ${schem.name} | Assembly Quality: ${expState.baseQuality}</p>
    </div>
    <div class="directed-exp-points" id="dirExpPoints">Experiment Points: ${pts}</div>
    <div class="directed-exp-result" id="dirExpResult">${pts > 0 ? 'Choose an attribute to boost.' : 'All points spent.'}</div>`;

  for (const stat of stats) {
    const maxBar = stat.key === 'quality' ? 800 : 500;
    const pct = Math.min(100, Math.floor((stat.value / maxBar) * 100));
    const attempts = expState.expAttempts[stat.key] || 0;
    const difficulty = 40 + attempts * 10;

    html += `<div class="directed-exp-stat">
      <div class="directed-exp-stat-header">
        <span class="directed-exp-stat-name">${stat.label} <span style="font-size:10px;color:#666;">${stat.desc}</span></span>
        <span class="directed-exp-stat-value">${stat.value}</span>
      </div>
      <div class="directed-exp-bar-outer">
        <div class="directed-exp-bar ${stat.barClass}" style="width:${pct}%"></div>
      </div>
      <button class="directed-exp-boost-btn" id="boostBtn_${stat.key}"
        onclick="boostExperiment('${stat.key}')"
        ${pts <= 0 ? 'disabled' : ''}
        title="Success threshold: ${difficulty}+">+ Boost ${stat.label} (need ${difficulty}+)</button>
    </div>`;
  }

  html += `<button class="directed-exp-finish-btn" onclick="finishExperiment()">Finish Crafting</button>`;
  html += `</div>`;

  content.innerHTML = html;
}

function boostExperiment(statKey) {
  if (!expState || expState.pointsLeft <= 0) return;

  // Disable all boost buttons during roll
  const btns = document.querySelectorAll('.directed-exp-boost-btn');
  btns.forEach(b => b.disabled = true);

  const attempts = expState.expAttempts[statKey] || 0;
  const threshold = 40 + attempts * 10; // gets harder each time on same stat

  // Flickering animation on the stat value
  const statValueEl = document.querySelector(`#boostBtn_${statKey}`).closest('.directed-exp-stat').querySelector('.directed-exp-stat-value');
  const resultEl = document.getElementById('dirExpResult');
  const originalValue = statValueEl.textContent;

  let flickerCount = 0;
  const flickerInterval = setInterval(() => {
    statValueEl.textContent = Math.floor(Math.random() * 500);
    statValueEl.style.opacity = Math.random() > 0.3 ? '1' : '0.5';
    flickerCount++;
    if (flickerCount > 5) {
      clearInterval(flickerInterval);
      statValueEl.style.opacity = '1';
      resolveBoost();
    }
  }, 60);

  function resolveBoost() {
    let roll = Math.floor(Math.random() * 100) + 1;
    if (isWorldEventActive('craftBoost')) roll += 20;
    expState.pointsLeft--;
    expState.expAttempts[statKey] = (expState.expAttempts[statKey] || 0) + 1;

    if (roll > threshold) {
      // SUCCESS
      const bonus = 50 + Math.floor(Math.random() * 101); // +50 to +150
      switch (statKey) {
        case 'damage': expState.expDamage += bonus; break;
        case 'defense': expState.expDefense += bonus; break;
        case 'quality': expState.expQuality += bonus; break;
        case 'special': expState.expSpecial += bonus; break;
      }
      resultEl.innerHTML = `<span style="color:#4fc878;">SUCCESS! +${bonus} ${statKey} (rolled ${roll} vs ${threshold}+)</span>`;
    } else if (roll >= 10) {
      // FAILURE — no change
      resultEl.innerHTML = `<span style="color:#f66;">FAILED -- no change (rolled ${roll} vs ${threshold}+)</span>`;
    } else {
      // CRITICAL FAILURE — lose some of that stat
      const penalty = 50;
      switch (statKey) {
        case 'damage': expState.expDamage = Math.max(0, expState.expDamage - penalty); break;
        case 'defense': expState.expDefense = Math.max(0, expState.expDefense - penalty); break;
        case 'quality': expState.expQuality = Math.max(-expState.baseQuality + 1, expState.expQuality - penalty); break;
        case 'special': expState.expSpecial = Math.max(0, expState.expSpecial - penalty); break;
      }
      resultEl.innerHTML = `<span style="color:#f00;">CRITICAL FAIL! -${penalty} ${statKey} (rolled ${roll})</span>`;
    }

    // Re-render with updated values
    renderDirectedExperimentation();
  }
}

function finishExperiment() {
  if (!expState) return;

  const schem = expState.schem;

  // Remove used essences from inventory
  for (const ess of craftState.selectedEssences) {
    const idx = G.essences.findIndex(e => e.id === ess.id);
    if (idx >= 0) G.essences.splice(idx, 1);
  }

  if (expState.itemDestroyed) {
    notify('Assembly destroyed the item. Essences lost.');
    document.getElementById('experimentOverlay').classList.remove('active');
    expState = null;
    craftState.selectedEssences = [];
    renderCraftUI();
    saveGame();
    return;
  }

  // Create the gear with directed experiment results factored in
  let quality = Math.max(1, expState.baseQuality + expState.expQuality);

  // Guild crafting bonus
  const guildBonus = (typeof getGuildCraftBonus === 'function') ? getGuildCraftBonus() : 0;
  quality += guildBonus;

  // Profession skill quality bonuses
  if (hasSkill('bs_1') && (schem.type === 'weapon' || schem.type === 'armor')) quality += 50; // Forge Hand
  if (hasSkill('ss_1') && schem.id.includes('blade')) quality += 50; // Blade Apprentice
  if (hasSkill('be_1') && schem.id.includes('blaster')) quality += 50; // Blaster Tinkerer
  const qualityTier = quality > 600 ? 'Mastercraft' : quality > 400 ? 'Superior' : quality > 200 ? 'Standard' : 'Basic';

  const essences = craftState.selectedEssences;
  const avgPotency = essences.reduce((s, e) => s + e.potency, 0) / essences.length;
  const avgStability = essences.reduce((s, e) => s + e.stability, 0) / essences.length;
  const avgResonance = essences.reduce((s, e) => s + e.resonance, 0) / essences.length;
  const avgPurity = essences.reduce((s, e) => s + e.purity, 0) / essences.length;

  // Bonus damage from base quality + experiment damage boosts
  const baseBonusDmg = schem.type === 'weapon' ? Math.floor(quality / 300) + 1 : 0;
  const expBonusDmg = Math.floor(expState.expDamage / 200);
  const baseDmgRed = schem.type === 'armor' ? Math.floor(quality / 400) + 1 : 0;
  const expDmgRed = Math.floor(expState.expDefense / 200);

  const gear = {
    id: Date.now(),
    name: `${qualityTier} ${schem.name}`,
    schematic: schem.id,
    type: schem.type,
    slot: schem.slot || schem.type,
    icon: schem.icon || '',
    tier: schem.tier || 'common',
    quality,
    qualityTier,
    desc: schem.desc,
    bonusDamage: baseBonusDmg + expBonusDmg,
    damageReduction: baseDmgRed + expDmgRed,
    specialBonus: expState.expSpecial,
    craftedBy: G.name,
    craftedAt: Date.now(),
    essenceNames: essences.map(e => e.fromName),
    stats: { potency: Math.floor(avgPotency), stability: Math.floor(avgStability), resonance: Math.floor(avgResonance), purity: Math.floor(avgPurity) },
    assemblyMod: expState.assemblyMod,
  };

  if (expState.schem.type === 'component') {
    // Components go to materials inventory, not gear
    if (!G.materials) G.materials = {};
    G.materials[expState.schem.id] = (G.materials[expState.schem.id] || 0) + 1;
  } else {
    G.gear.push(gear);
  }

  // Profession XP: crafting
  const craftXP = gear.qualityTier === 'Mastercraft' ? 50 : gear.qualityTier === 'Superior' ? 30 : 15;
  addProfessionXP('crafting', craftXP);

  SFX.craftSuccess();

  // Quest progress: craft complete
  checkQuestProgress('craft_complete', { qualityTier: gear.qualityTier });
  advanceWeeklyChallenge('craft');

  // Reputation: crafts completed
  if (!G.rep) G.rep = { battlesWon:0, craftsCompleted:0, itemsSold:0, essencesCollected:0, raresFound:0 };
  G.rep.craftsCompleted++;
  checkAndNotifyTitles();

  // Onboarding: after first craft, show market hint
  advanceOnboarding(4);

  // Grant mastery XP
  if (!G.mastery[schem.type]) G.mastery[schem.type] = { xp: 0 };
  G.mastery[schem.type].xp += 1;
  const newMastery = getMasteryInfo(G.mastery[schem.type].xp);
  const prevMastery = getMasteryInfo(G.mastery[schem.type].xp - 1);
  if (newMastery.name !== prevMastery.name) {
    notify(`${schem.type.charAt(0).toUpperCase() + schem.type.slice(1)} Mastery: ${newMastery.name}!`);
  }

  // Show result in craft modal
  const resultEl = document.getElementById('craftResult');
  resultEl.style.display = 'block';
  const assemblyLabel = expState.assemblyMod > 0 ? 'Amazing' : expState.assemblyMod === 0 ? 'Good' : expState.assemblyMod >= -0.1 ? 'Average' : 'Poor';
  const qualColor = quality > 600 ? '#4a8' : quality > 400 ? '#daa520' : '#a66';
  const qualLabel = quality > 600 ? 'Masterwork' : quality > 400 ? 'Fine' : 'Standard';
  resultEl.innerHTML = `<div class="craft-result">
    <h3 style="color:#4a8;margin:0 0 8px;">${gear.name}</h3>
    <p style="font-size:12px;color:#888;">${schem.desc}</p>
    <p style="font-size:13px;color:#ccc;margin-top:8px;">
      Quality: <strong style="color:${qualColor}">${quality}</strong>
      ${gear.bonusDamage ? ` | +${gear.bonusDamage} Damage` : ''}
      ${gear.damageReduction ? ` | -${gear.damageReduction} Damage Taken` : ''}
      ${gear.specialBonus > 0 ? ` | Special +${gear.specialBonus}` : ''}
    </p>
    <p style="font-size:10px;color:#556;margin-top:4px;">Assembly: ${assemblyLabel} | Crafted by ${gear.craftedBy}</p>
  </div>`;

  // Dramatic craft reveal overlay
  showCraftReveal(gear.name, qualLabel, qualColor, gear.craftedBy);

  notify(`Crafted: ${gear.name} (Quality ${quality})!`);

  document.getElementById('experimentOverlay').classList.remove('active');
  expState = null;
  craftState.selectedEssences = [];
  saveGame();
  renderCraftUI();
}

function closeCrafting() {
  document.getElementById('craftOverlay').classList.remove('active');
  craftQuickMode = false;
}

// ═══════ RESOURCE REPORT ═══════

function openResourceReport() {
  const cycleId = getZoneCycleId();
  const body = document.getElementById('resourceReportBody');
  let html = '';
  for (let i = 0; i < ENCOUNTER_ZONES.length; i++) {
    const zone = ENCOUNTER_ZONES[i];
    const q = getZoneQuality(i, cycleId);
    const label = getZoneQualityLabel(q);
    const cls = getZoneQualityClass(q);
    html += `<div class="zone-report-row">
      <span class="zone-report-name">${zone.name}</span>
      <span>
        <span class="zone-report-mult">x${q.toFixed(2)}</span>
        <span class="zone-report-quality ${cls}">${label}</span>
      </span>
    </div>`;
  }
  body.innerHTML = html;
  document.getElementById('resourceReportOverlay').classList.add('active');
}

function closeResourceReport() {
  document.getElementById('resourceReportOverlay').classList.remove('active');
}


// ═══════ CRAFT LOCATION RULES ═══════

let craftQuickMode = false; // true = quick craft (common only, anywhere)

function openQuickCraft() {
  if (G.essences.length < 1) {
    notify('You need Spirit Essences to craft. Battle wild Spiritkin!');
    return;
  }
  craftQuickMode = true;
  const masteryType = SCHEMATICS[0].type;
  const masteryXp = G.mastery[masteryType]?.xp || 0;
  const masteryLvl = getMasteryLevel(masteryXp);
  const baseExp = G.discipline === 'artificer' ? 3 : 1;
  // Find first common schematic
  const firstCommon = SCHEMATICS.find(s => s.tier === 'common') || SCHEMATICS[0];
  const tnkBonus3 = hasSkill('tnk_1') ? 1 : 0; // Apprentice: +1 experiment point
  craftState = { selectedEssences: [], schematic: firstCommon, experimentPoints: baseExp + masteryLvl + tnkBonus3 };
  renderCraftUI();
  document.getElementById('craftOverlay').classList.add('active');
}

