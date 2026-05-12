// QUESTS
// Quests — Mask of Destiny, daily quests, weekly challenges, lore, gathering
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ MASK OF DESTINY — DAILY HIDDEN QUEST ═══════

const MASK_QUEST = {
  name: 'The Mask of Destiny',
  phases: [
    {
      id: 1, name: 'The Discovery', hours: [6, 10], region: 'frost',
      marker: { x: HUB.x + 4, y: HUB.y + 6, name: 'Maren' },
      markerColor: '#d4a44a',
      dialogue: [
        "You look like someone who doesn't give up easily.",
        "My Leon... Valkin cursed him. Turned him into a wandering spirit.",
        "I've waited so long. Will you help me find him?",
        "Take his bandana. It still smells like the hills where he grew up.",
      ],
      anchor: { id: 'bandana', name: "Leon's Bandana", icon: '\uD83C\uDF97\uFE0F' },
      prompt: '[E] Talk to Maren',
    },
    {
      id: 2, name: 'The Trail', hours: [10, 14], region: 'hills',
      marker: { x: 30, y: 52, name: "Leon's Camp" },
      markerColor: '#8ad46e',
      dialogue: [
        "These are Leon's things. His fire pit. His bedroll.",
        "A letter... 'Maren, if you find this, know that I tried to come back.'",
        "A ghostly figure flickers at the edge of the camp... Leon!",
        "He's moving toward the Dark Castle. The curse pulls him there.",
      ],
      anchor: { id: 'vow', name: "The Vow", icon: '\uD83D\uDCDC' },
      prompt: '[E] Search the camp',
    },
    {
      id: 3, name: 'The Gathering', hours: [14, 18], region: 'dark_castle',
      marker: { x: 99, y: 12, name: "Curse Fragment" },
      markerColor: '#b488e0',
      dialogue: [
        "The fragment pulses with dark energy. This is a piece of Valkin's curse.",
        "Valkin's voice echoes: 'You think love can break what I've made?'",
        "The fragment burns cold in your hands. You need fire to destroy it.",
        "The curse was born in cold. It can only die in fire.",
      ],
      anchor: { id: 'fragment', name: "The Fragment", icon: '\uD83D\uDC8E' },
      prompt: '[E] Take the Fragment',
    },
    {
      id: 4, name: 'The Reckoning', hours: [18, 24], region: 'volcanic',
      marker: { x: 74, y: 30, name: "Ritual Circle" },
      markerColor: '#ff8844',
      dialogue: [
        "The lava's heat reacts to the three anchors. They begin to glow.",
        "Leon's form materializes from the fire. Solid. Real. Alive.",
        "Leon: 'Is she... is Maren still waiting?'",
        "Take Leon back to the Frozen Mug. Maren is waiting.",
      ],
      anchor: null,
      prompt: '[E] Begin the ritual',
      completion: {
        returnTo: { x: HUB.x + 4, y: HUB.y + 6 },
        finalDialogue: [
          "Maren: 'Leon...? LEON!'",
          "Leon: 'I'm here. I'm really here.'",
          "Maren: 'You found him. You actually found him.'",
          "The curse is broken. Love won.",
          "You receive: THE MASK OF DESTINY",
        ],
        reward: { coins: 200, title: 'Curse Breaker' },
      },
    },
  ],
};

function getMaskQuestPhase() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 1;
  if (hour >= 10 && hour < 14) return 2;
  if (hour >= 14 && hour < 18) return 3;
  if (hour >= 18 && hour < 24) return 4;
  return 0;
}

function getMaskQuestDaySeed() {
  return Math.floor(Date.now() / 86400000);
}

function initMaskQuest() {
  if (!G.maskQuest) G.maskQuest = { phase: 0, anchors: [], completedDays: 0, lastCompleted: 0, startedDay: 0 };
  const today = getMaskQuestDaySeed();
  // Already completed today — nothing to do
  if (G.maskQuest.lastCompleted === today && G.maskQuest.phase === 5) return;
  // New day — reset incomplete progress so the quest is fresh each day
  if (G.maskQuest.phase > 0 && G.maskQuest.phase < 5 && G.maskQuest.startedDay !== today) {
    G.maskQuest.phase = 0;
    G.maskQuest.anchors = [];
  }
}

function getMaskQuestActivePhaseData() {
  const realPhase = getMaskQuestPhase();
  if (realPhase === 0) return null;
  const mq = G.maskQuest;
  if (!mq) return null;
  if (mq.lastCompleted === getMaskQuestDaySeed() && mq.phase === 5) return null;
  if (realPhase === 1 && mq.phase === 0) return MASK_QUEST.phases[0];
  if (realPhase >= 2 && mq.phase === realPhase - 1) return MASK_QUEST.phases[realPhase - 1];
  if (mq.phase === 4 && realPhase === 4) return MASK_QUEST.phases[3];
  return null;
}

function tryMaskQuestInteract() {
  const phaseData = getMaskQuestActivePhaseData();
  if (!phaseData) return false;

  const mx = phaseData.marker.x;
  const my = phaseData.marker.y;
  const dist = Math.sqrt((G.x - mx) ** 2 + (G.y - my) ** 2);

  if (dist > 2.5) {
    if (phaseData.id === 4 && G.maskQuest.phase === 4 && G.maskQuest.anchors.length === 3) {
      const rt = phaseData.completion.returnTo;
      const rtDist = Math.sqrt((G.x - rt.x) ** 2 + (G.y - rt.y) ** 2);
      if (rtDist < 2.5) {
        showMaskQuestDialogue(phaseData.completion.finalDialogue, function() {
          G.maskQuest.phase = 5;
          G.maskQuest.completedDays++;
          G.maskQuest.lastCompleted = getMaskQuestDaySeed();
          G.coins += phaseData.completion.reward.coins;
          if (!G.titles.includes(phaseData.completion.reward.title)) {
            G.titles.push(phaseData.completion.reward.title);
          }
          notify('Quest complete! +200 coins. Title earned: Curse Breaker');
          SFX.notify();
          updateHUD();
          updateMaskQuestTracker();
          saveGame();
        });
        return true;
      }
    }
    return false;
  }

  if (phaseData.id === 1 && G.maskQuest.phase > 0) return false;
  if (phaseData.id === 2 && !G.maskQuest.anchors.includes('bandana')) return false;
  if (phaseData.id === 3 && !G.maskQuest.anchors.includes('vow')) return false;
  if (phaseData.id === 4 && G.maskQuest.anchors.length < 3) return false;

  showMaskQuestDialogue(phaseData.dialogue, function() {
    if (phaseData.anchor && !G.maskQuest.anchors.includes(phaseData.anchor.id)) {
      G.maskQuest.anchors.push(phaseData.anchor.id);
      notify('Received: ' + phaseData.anchor.icon + ' ' + phaseData.anchor.name);
      SFX.notify();
    }
    G.maskQuest.phase = phaseData.id;
    if (phaseData.id === 1) G.maskQuest.startedDay = getMaskQuestDaySeed();
    if (phaseData.id === 4) {
      notify('Take Leon back to Maren at the cantina in Frost Valley.');
    }
    updateMaskQuestTracker();
    updateHUD();
    saveGame();
  });
  return true;
}

let maskDialogueIdx = 0;
let maskDialogueLines = [];
let maskDialogueCallback = null;

function showMaskQuestDialogue(lines, onComplete) {
  maskDialogueLines = lines;
  maskDialogueIdx = 0;
  maskDialogueCallback = onComplete;
  const overlay = document.getElementById('maskDialogueOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.style.opacity = '1', 10);
  renderMaskDialogueLine();
}

function renderMaskDialogueLine() {
  document.getElementById('maskDialogueText').textContent = maskDialogueLines[maskDialogueIdx];
  document.getElementById('maskDialogueBtn').textContent =
    maskDialogueIdx >= maskDialogueLines.length - 1 ? 'Close' : 'Continue \u25B6';
}

function advanceMaskDialogue() {
  maskDialogueIdx++;
  if (maskDialogueIdx >= maskDialogueLines.length) {
    closeMaskDialogue();
    if (maskDialogueCallback) maskDialogueCallback();
    maskDialogueCallback = null;
  } else {
    renderMaskDialogueLine();
  }
}

function closeMaskDialogue() {
  const overlay = document.getElementById('maskDialogueOverlay');
  overlay.style.opacity = '0';
  setTimeout(() => overlay.style.display = 'none', 300);
}

function updateMaskQuestTracker() {
  const tracker = document.getElementById('maskQuestTracker');
  if (!tracker) return;
  const mq = G.maskQuest;
  if (!mq) { tracker.style.display = 'none'; return; }

  const realPhase = getMaskQuestPhase();
  const today = getMaskQuestDaySeed();

  if (mq.phase === 0 && realPhase === 0) { tracker.style.display = 'none'; return; }
  if (mq.phase === 5 && mq.lastCompleted === today) { tracker.style.display = 'none'; return; }
  if (mq.phase === 0 && realPhase > 0) {
    tracker.style.display = 'block';
    if (realPhase === 1) {
      document.getElementById('maskQuestStatus').innerHTML =
        'Phase 1 available<br><span style="color:#6a5a4a;font-size:10px;">Find Maren near the cantina</span>';
    } else {
      document.getElementById('maskQuestStatus').innerHTML =
        'Quest begins at 6:00 AM<br><span style="color:#6a5a4a;font-size:10px;">Find Maren near the cantina during Phase 1</span>';
    }
    return;
  }

  tracker.style.display = 'block';
  const anchorsText = mq.anchors.map(a => {
    const phase = MASK_QUEST.phases.find(p => p.anchor && p.anchor.id === a);
    return phase ? phase.anchor.icon : '';
  }).join(' ');

  let statusText = '';
  if (mq.phase < 4) {
    const nextPhase = MASK_QUEST.phases[mq.phase];
    if (nextPhase) {
      statusText = nextPhase.name + ' (' + nextPhase.hours[0] + ':00-' + nextPhase.hours[1] + ':00)';
    }
  } else if (mq.phase === 4 && mq.anchors.length === 3) {
    statusText = 'Return Leon to Maren';
  }

  document.getElementById('maskQuestStatus').innerHTML =
    (anchorsText ? anchorsText + '<br>' : '') +
    '<span style="color:#9a8b7b;">' + statusText + '</span>';
}

function renderMaskQuestMarkers(ctx, camX, camY, time) {
  const phaseData = getMaskQuestActivePhaseData();
  if (!phaseData) return;

  const mx = phaseData.marker.x;
  const my = phaseData.marker.y;
  const sx = mx * TILE - camX;
  const sy = my * TILE - camY;

  if (sx < -60 || sx > canvas.width + 60 || sy < -60 || sy > canvas.height + 60) return;

  const pulse = 0.6 + Math.sin(time * 2.5) * 0.4;
  const color = phaseData.markerColor;

  ctx.save();
  ctx.globalAlpha = pulse * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx + TILE/2, sy + TILE/2, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx + TILE/2, sy + TILE/2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(phaseData.marker.name, sx + TILE/2, sy - 10);

  const dist = Math.sqrt((G.x - mx) ** 2 + (G.y - my) ** 2);
  if (dist < 2.5) {
    const promptAlpha = 0.5 + Math.sin(time * 3) * 0.3;
    ctx.fillStyle = 'rgba(212,164,74,' + promptAlpha + ')';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(phaseData.prompt, sx + TILE/2, sy - 22);
  }
  ctx.restore();

  // Phase 4 return marker (Maren in Frost Valley)
  if (phaseData.id === 4 && G.maskQuest.phase === 4 && G.maskQuest.anchors.length === 3) {
    const rt = phaseData.completion.returnTo;
    const rtsx = rt.x * TILE - camX;
    const rtsy = rt.y * TILE - camY;
    if (rtsx > -60 && rtsx < canvas.width + 60 && rtsy > -60 && rtsy < canvas.height + 60) {
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#d4a44a';
      ctx.beginPath();
      ctx.arc(rtsx + TILE/2, rtsy + TILE/2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d4a44a';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Maren', rtsx + TILE/2, rtsy - 10);
      const rtDist = Math.sqrt((G.x - rt.x) ** 2 + (G.y - rt.y) ** 2);
      if (rtDist < 2.5) {
        const pa = 0.5 + Math.sin(time * 3) * 0.3;
        ctx.fillStyle = 'rgba(212,164,74,' + pa + ')';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('[E] Reunite', rtsx + TILE/2, rtsy - 22);
      }
      ctx.restore();
    }
  }
}

// ═══════ LORE ITEMS ═══════
const LORE_ITEMS = [
  // Frost Valley
  { x: 35, y: 15, id: 'lore_1', title: 'Ancient Tablet', text: 'The Spiritkin were not always bound to this world. They came through the Rift when the Overworld fractured...', region: 'frost' },
  { x: 20, y: 35, id: 'lore_2', title: 'Frozen Journal', text: 'Elder Frost was the first Warden. He taught the others that Spiritkin are not pets \u2014 they are partners.', region: 'frost' },
  { x: 45, y: 25, id: 'lore_3', title: 'Ice Crystal Memory', text: 'The Crystal Glade was once a battlefield. The spirits who fell there became the first wild Spiritkin.', region: 'frost' },
  { x: 10, y: 18, id: 'lore_4', title: 'Warden\'s Note', text: 'To anyone who finds this: the path between Frost Valley and the Rolling Hills is not natural. Someone carved it.', region: 'frost' },
  // Rolling Hills
  { x: 30, y: 55, id: 'lore_5', title: 'Meadow Stone', text: 'The Rolling Hills remember a time of peace. Before the Volcanic eruption, all three regions were one land.', region: 'hills' },
  { x: 18, y: 62, id: 'lore_6', title: 'Farmer\'s Diary', text: 'The Spiritkin here are gentle. Selene watches over the hills at night. I\'ve seen her light from my window.', region: 'hills' },
  { x: 42, y: 48, id: 'lore_7', title: 'Old Map Fragment', text: 'There was once a fourth region \u2014 the Dark Castle. The entrance was sealed after Valkin\'s betrayal.', region: 'hills' },
  // Volcanic Isles
  { x: 72, y: 12, id: 'lore_8', title: 'Obsidian Shard', text: 'The volcanic glass holds memories. Touch it and you can feel the heat of the eruption that split the land.', region: 'volcanic' },
  { x: 80, y: 28, id: 'lore_9', title: 'Lava-Sealed Letter', text: 'Nerina guards the deep waters. She is not hostile \u2014 she is mourning. Her home was destroyed in the eruption.', region: 'volcanic' },
  { x: 68, y: 38, id: 'lore_10', title: 'Palm Bark Carving', text: 'The Volcanic Isles were a paradise once, and they will be again. The lava creates new land even as it destroys.', region: 'volcanic' },
  // Passages (dangerous spots)
  { x: 59, y: 21, id: 'lore_11', title: 'Carved Warning', text: 'TURN BACK. The passage between regions is watched. The roaming spirits here are stronger than they appear.', region: 'passage' },
  { x: 29, y: 44, id: 'lore_12', title: 'Border Marker', text: 'This stone marks the boundary between Frost Valley and the Rolling Hills. Placed by the First Wardens.', region: 'passage' },
  // Dark Castle
  { x: 95, y: 15, id: 'lore_dc_1', title: 'Valkin\'s Throne', text: 'The throne is empty. Valkin roams the Overworld now, but his power still echoes in these walls.', region: 'dark_castle' },
  { x: 102, y: 35, id: 'lore_dc_2', title: 'Dark Seal', text: 'This seal was meant to keep the Dark Castle closed forever. Someone broke it from the inside.', region: 'dark_castle' },
];

// ═══════ REGION CRYSTALS ═══════
const REGION_CRYSTALS = [
  { id: 'crystal_frost', x: 45, y: 10, region: 'frost', name: 'Frost Crystal', color: '#88ccff', found: false },
  { id: 'crystal_hills', x: 40, y: 58, region: 'hills', name: 'Meadow Crystal', color: '#88dd66', found: false },
  { id: 'crystal_volcanic', x: 82, y: 8, region: 'volcanic', name: 'Flame Crystal', color: '#ff8844', found: false },
  { id: 'crystal_dark', x: 105, y: 15, region: 'dark', name: 'Shadow Crystal', color: '#aa66dd', found: false },
];

// ═══════ HIDDEN TREASURE CHESTS ═══════
const TREASURE_CHESTS = [
  { id: 'chest_0', x: 5, y: 38, reward: { coins: 50, material: 'frozen_crystal' }, opened: false },
  { id: 'chest_1', x: 52, y: 5, reward: { coins: 30, material: 'iron_ore' }, opened: false },
  { id: 'chest_2', x: 48, y: 42, reward: { coins: 40, material: 'ancient_wood' }, opened: false },
  { id: 'chest_3', x: 15, y: 65, reward: { coins: 35, material: 'spirit_thread' }, opened: false },
  { id: 'chest_4', x: 85, y: 35, reward: { coins: 45, material: 'volcanic_glass' }, opened: false },
  { id: 'chest_5', x: 70, y: 5, reward: { coins: 60, material: 'ember_dust' }, opened: false },
  { id: 'chest_6', x: 100, y: 35, reward: { coins: 75, material: 'mask_fragment' }, opened: false },
  { id: 'chest_7', x: 95, y: 5, reward: { coins: 100, essence: true }, opened: false },
];

// ═══════ SCENIC VIEWPOINTS ═══════
const VIEWPOINTS = [
  { id: 'vp_0', x: 30, y: 3, name: 'Northern Peak', desc: 'The entirety of Frost Valley stretches below.' },
  { id: 'vp_1', x: 55, y: 22, name: 'Mountain Pass Overlook', desc: 'You can see both Frost Valley and the Volcanic Isles from here.' },
  { id: 'vp_2', x: 75, y: 3, name: 'Volcanic Rim', desc: 'Lava rivers glow like veins of fire across the islands.' },
  { id: 'vp_3', x: 25, y: 67, name: 'Southern Meadow', desc: 'Flowers stretch as far as you can see.' },
  { id: 'vp_4', x: 105, y: 3, name: 'Dark Castle Tower', desc: 'The entire Overworld is visible from Valkin\'s tower. Everything he wanted to control.' },
];

// ═══════ PATH SIGNS ═══════
const PATH_SIGNS = [
  { x: 16, y: 15, text: '\u2191 Polaris Hub  \u2193 Rolling Hills  \u2192 Crystal Glade' },
  { x: 28, y: 43, text: '\u2191 Frost Valley  \u2193 Meadowbrook' },
  { x: 58, y: 21, text: '\u2190 Frost Valley  \u2192 Volcanic Isles' },
  { x: 88, y: 20, text: '\u2190 Volcanic Isles  \u2192 Dark Castle' },
  { x: 25, y: 55, text: '\u2191 Frost Valley  Meadowbrook \u2192' },
  { x: 72, y: 20, text: 'Volcanic Settlement \u2191' },
];

// ═══════ FOOTPRINT TRAIL ═══════
const footprints = [];

// ═══════ AMBIENT EVENTS ═══════
const AMBIENT_EVENTS = [
  // Frost Valley
  { region: 'frost_valley', text: 'A cold wind sweeps through. The snow sparkles.', chance: 0.001 },
  { region: 'frost_valley', text: 'You hear distant howling from the mountains.', chance: 0.001 },
  { region: 'frost_valley', text: 'Aurora light dances across the sky above you.', chance: 0.0008 },
  // Rolling Hills
  { region: 'rolling_hills', text: 'Wildflowers sway in a gentle breeze.', chance: 0.001 },
  { region: 'rolling_hills', text: 'A butterfly Spiritkin flutters past but doesn\'t stop.', chance: 0.0008 },
  { region: 'rolling_hills', text: 'The grass here smells sweet. You feel at peace.', chance: 0.001 },
  // Volcanic Isles
  { region: 'volcanic_isles', text: 'The ground rumbles faintly beneath your feet.', chance: 0.001 },
  { region: 'volcanic_isles', text: 'Steam rises from a crack in the obsidian.', chance: 0.001 },
  { region: 'volcanic_isles', text: 'A wave crashes on the distant beach. Paradise and danger.', chance: 0.0008 },
  // Dark Castle
  { region: 'dark_castle', text: 'Shadows shift in the corners of your vision. Something is watching.', chance: 0.001 },
  { region: 'dark_castle', text: 'A cold, unnatural wind howls through the dead trees.', chance: 0.001 },
  { region: 'dark_castle', text: 'The walls of the castle seem to pulse with dark energy.', chance: 0.0008 },
];

let lastAmbientTime = 0;

// ═══════ NPC QUEST SYSTEM ═══════

function getDaySeed() {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24));
}

const QUEST_POOL = {
  'Elder Frost': [
    { id_prefix: 'ef_001', title: 'Premium Essence', desc: 'Bring me an essence with Potency above 700.', type: 'collect_essence', requirement: { stat: 'potency', min: 700 }, reward: { coins: 15, title: null }, target: 1 },
    { id_prefix: 'ef_002', title: 'Essence Harvest', desc: 'Collect 3 essences from any zone.', type: 'collect_essences_count', requirement: { count: 3 }, reward: { coins: 10, title: null }, target: 3 },
    { id_prefix: 'ef_003', title: 'Perfect Specimen', desc: 'Find an essence with all stats above 500.', type: 'collect_essence_allstats', requirement: { min: 500 }, reward: { coins: 20, title: null, schematicUnlock: true }, target: 1 },
  ],
  'Smith Ember': [
    { id_prefix: 'se_001', title: 'Superior Work', desc: 'Craft a Superior or better item.', type: 'craft_quality', requirement: { minTier: 'Superior' }, reward: { coins: 15, title: null }, target: 1 },
    { id_prefix: 'se_002', title: 'Double Down', desc: 'Craft 2 items of any quality.', type: 'craft_count', requirement: { count: 2 }, reward: { coins: 10, title: null }, target: 2 },
    { id_prefix: 'se_003', title: 'Masterwork', desc: 'Craft a Mastercraft item.', type: 'craft_quality', requirement: { minTier: 'Mastercraft' }, reward: { coins: 30, title: 'Forge Master', rewardItem: 'spirit_trap' }, target: 1 },
  ],
  'Keeper Zara': [
    { id_prefix: 'kz_001', title: 'Spirit Patrol', desc: 'Win 5 wild encounters.', type: 'win_battles', requirement: { count: 5 }, reward: { coins: 12, title: null }, target: 5 },
    { id_prefix: 'kz_002', title: 'Rare Hunt', desc: 'Defeat a rare or better Spiritkin.', type: 'defeat_rarity', requirement: { minRarity: 'rare' }, reward: { coins: 20, title: null }, target: 1 },
    { id_prefix: 'kz_003', title: 'No Retreat', desc: 'Win 3 encounters without fleeing.', type: 'win_no_flee', requirement: { count: 3 }, reward: { coins: 15, title: null }, target: 3 },
  ],
};

// ═══════ WEEKLY CHALLENGES ═══════
const WEEKLY_CHALLENGES = [
  { id: 'wk_battle', name: 'Spirit Storm', desc: 'Win 20 battles this week', type: 'battles', target: 20, reward: { coins: 100, title: 'Storm Survivor' } },
  { id: 'wk_craft', name: 'Forge Week', desc: 'Craft 5 items this week', type: 'crafts', target: 5, reward: { coins: 75, title: 'Weekly Forger' } },
  { id: 'wk_explore', name: 'Wanderlust', desc: 'Visit all 4 regions this week', type: 'regions', target: 4, reward: { coins: 80, title: 'World Walker' } },
  { id: 'wk_collect', name: 'Essence Harvest', desc: 'Collect 30 essences this week', type: 'essences', target: 30, reward: { coins: 90, title: 'Harvester' } },
];

function getWeekId() { return Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)); }

function getActiveWeeklyChallenge() {
  const weekId = getWeekId();
  if (!G.weeklyChallenge || G.weeklyChallenge.weekId !== weekId) {
    const idx = weekId % WEEKLY_CHALLENGES.length;
    G.weeklyChallenge = { weekId, challengeIdx: idx, progress: 0, regionsVisited: [], completed: false };
  }
  return { challenge: WEEKLY_CHALLENGES[G.weeklyChallenge.challengeIdx], state: G.weeklyChallenge };
}

function advanceWeeklyChallenge(type, data) {
  const { challenge, state } = getActiveWeeklyChallenge();
  if (state.completed) return;

  if (type === 'battle' && challenge.type === 'battles') {
    state.progress++;
  } else if (type === 'craft' && challenge.type === 'crafts') {
    state.progress++;
  } else if (type === 'essence' && challenge.type === 'essences') {
    state.progress++;
  } else if (type === 'region' && challenge.type === 'regions') {
    if (!state.regionsVisited) state.regionsVisited = [];
    if (!state.regionsVisited.includes(data)) {
      state.regionsVisited.push(data);
      state.progress = state.regionsVisited.length;
    }
  }

  if (state.progress >= challenge.target && !state.completed) {
    state.completed = true;
    G.coins += challenge.reward.coins;
    if (challenge.reward.title && !G.titles.includes(challenge.reward.title)) {
      G.titles.push(challenge.reward.title);
    }
    notify(`Weekly Challenge complete: ${challenge.name}! +${challenge.reward.coins} coins`);
    if (challenge.reward.title) notify(`Title earned: ${challenge.reward.title}!`);
    updateHUD();
    saveGame();
  }
}

function renderWeeklyChallengeInInventory() {
  const el = document.getElementById('weeklyChallengeArea');
  if (!el) return;
  const { challenge, state } = getActiveWeeklyChallenge();
  const pct = Math.min(100, Math.floor(state.progress / challenge.target * 100));
  el.innerHTML = `<div class="quest-item" style="text-align:left;border-left:3px solid #f0a040;">
    <span class="quest-title" style="color:#f0a040;">${challenge.name}</span>
    ${state.completed ? '<span class="quest-complete-badge">Complete!</span>' : ''}
    <div class="quest-desc">${challenge.desc}</div>
    <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#f0a040,#ffcc44);"></div></div>
    <div class="quest-reward">Progress: ${state.progress}/${challenge.target} | Reward: ${challenge.reward.coins} coins${challenge.reward.title ? ' + "' + challenge.reward.title + '"' : ''}</div>
  </div>`;
}


const NPC_GATHERING_QUESTS = {
  'Farmer Bea': { desc: 'Bring me 3 Healing Seeds', materialId: null, resourceKey: 'healingSeeds', qty: 3, reward: 15, itemName: 'Healing Seeds' },
  'Herbalist Sage': { desc: 'I need 2 Crystal Chips', materialId: 'crystal_chip', resourceKey: null, qty: 2, reward: 20, itemName: 'Crystal Chips' },
  'Captain Flint': { desc: 'Collect 2 Ember Dust', materialId: 'ember_dust', resourceKey: null, qty: 2, reward: 15, itemName: 'Ember Dust' },
  'Lava Tender': { desc: 'Get me 1 Volcanic Glass', materialId: 'volcanic_glass', resourceKey: null, qty: 1, reward: 25, itemName: 'Volcanic Glass' },
  'Shadow Warden': { desc: 'Bring 3 Mask Fragments', materialId: 'mask_fragment', resourceKey: null, qty: 3, reward: 20, itemName: 'Mask Fragments' },
  'Cursed Scholar': { desc: 'I need 1 Frozen Crystal', materialId: 'frozen_crystal', resourceKey: null, qty: 1, reward: 30, itemName: 'Frozen Crystal' },
};

function getGatheringQuestStock(npcName) {
  const gq = NPC_GATHERING_QUESTS[npcName];
  if (!gq) return 0;
  if (gq.resourceKey) return G[gq.resourceKey] || 0;
  return G.materials?.[gq.materialId] || 0;
}

function acceptGatheringQuest(npcName) {
  if (!G.gatheringQuests) G.gatheringQuests = {};
  G.gatheringQuests[npcName] = { accepted: true };
  notify(`Gathering quest accepted from ${npcName}!`);
  saveGame();
  showDialogue(npcName);
}

function completeGatheringQuest(npcName) {
  const gq = NPC_GATHERING_QUESTS[npcName];
  if (!gq) return;
  const have = getGatheringQuestStock(npcName);
  if (have < gq.qty) {
    notify(`Not enough! Need ${gq.qty} ${gq.itemName} (have ${have})`);
    return;
  }
  // Deduct materials
  if (gq.resourceKey) {
    G[gq.resourceKey] -= gq.qty;
  } else {
    G.materials[gq.materialId] -= gq.qty;
  }
  // Grant reward
  G.coins += gq.reward;
  delete G.gatheringQuests[npcName];
  notify(`Gathering quest complete! +${gq.reward} coins`);
  addProfessionXP('trade', 5);
  updateHUD();
  saveGame();
  showDialogue(npcName);
}

function getNpcDailyQuest(npcName) {
  const daySeed = getDaySeed();
  const pool = QUEST_POOL[npcName];
  if (!pool) return null;
  const idx = ((daySeed * 7 + npcName.length * 13) % pool.length);
  const template = pool[idx];
  const questId = `${template.id_prefix}_${daySeed}`;
  return { ...template, id: questId, npc: npcName, progress: 0, completed: false };
}

function getActiveQuestForNpc(npcName) {
  if (!G.quests) G.quests = { active: [], completed: [] };
  return G.quests.active.find(q => q.npc === npcName && !q.completed);
}

function isQuestCompletedToday(npcName) {
  if (!G.quests) G.quests = { active: [], completed: [] };
  const daySeed = getDaySeed();
  return G.quests.completed.some(id => id.endsWith('_' + daySeed) && id.startsWith(QUEST_POOL[npcName]?.[0]?.id_prefix?.split('_')[0] || ''));
}

function acceptQuest(npcName) {
  if (!G.quests) G.quests = { active: [], completed: [] };
  const quest = getNpcDailyQuest(npcName);
  if (!quest) return;
  // Prevent duplicates
  if (G.quests.active.some(q => q.id === quest.id)) return;
  if (G.quests.completed.includes(quest.id)) return;
  G.quests.active.push(quest);
  notify(`Quest accepted: ${quest.title}`);
  saveGame();
  // Re-render dialogue with quest update
  showDialogue(npcName);
}

function completeQuest(quest) {
  if (!quest || quest.completed) return;
  quest.completed = true;
  // Grant rewards
  G.coins += quest.reward.coins;
  if (quest.reward.title) {
    // Add title to earned titles (via reputation system)
    notify(`Title earned: ${quest.reward.title}!`);
    if (!G.titles.includes(quest.reward.title)) G.titles.push(quest.reward.title);
  }
  // Grant reward item (e.g. Spirit Trap deed from crafting quests)
  if (quest.reward.rewardItem) {
    G.gear.push({
      id: Date.now(),
      name: 'Quest Spirit Trap',
      schematic: 'spirit_trap',
      type: 'accessory',
      slot: 'accessory',
      quality: 300,
      qualityTier: 'Superior',
      craftedBy: 'Quest Reward',
      craftedAt: Date.now(),
    });
    notify('Received: Quest Spirit Trap!');
  }
  notify(`Quest complete: ${quest.title} (+${quest.reward.coins} coins)`);
  // Move to completed
  if (!G.quests.completed) G.quests.completed = [];
  G.quests.completed.push(quest.id);
  G.quests.active = G.quests.active.filter(q => q.id !== quest.id);
  // Clean old completed quest IDs (keep only last 30 days)
  const oldestKeep = getDaySeed() - 30;
  G.quests.completed = G.quests.completed.filter(id => {
    const parts = id.split('_');
    const daySeed = parseInt(parts[parts.length - 1]);
    return !isNaN(daySeed) && daySeed >= oldestKeep;
  });
  updateHUD();
  saveGame();
}

function checkQuestProgress(type, data) {
  if (!G.quests?.active) return;
  for (const quest of G.quests.active) {
    if (quest.completed) continue;

    if (type === 'battle_won' && quest.type === 'win_battles') {
      quest.progress++;
    }
    if (type === 'battle_won' && quest.type === 'win_no_flee') {
      quest.progress++;
    }
    if (type === 'battle_won' && quest.type === 'defeat_rarity') {
      const rarityOrder = ['common','uncommon','rare','ghost-rare','legendary'];
      const minIdx = rarityOrder.indexOf(quest.requirement.minRarity);
      const defeatedIdx = rarityOrder.indexOf(data?.rarity);
      if (defeatedIdx >= minIdx) quest.progress++;
    }
    if (type === 'essence_collected' && quest.type === 'collect_essence') {
      const ess = data;
      if (ess && ess[quest.requirement.stat] >= quest.requirement.min) quest.progress++;
    }
    if (type === 'essence_collected' && quest.type === 'collect_essences_count') {
      quest.progress++;
    }
    if (type === 'essence_collected' && quest.type === 'collect_essence_allstats') {
      const ess = data;
      if (ess && ess.potency >= quest.requirement.min && ess.stability >= quest.requirement.min &&
          ess.resonance >= quest.requirement.min && ess.purity >= quest.requirement.min) {
        quest.progress++;
      }
    }
    if (type === 'craft_complete' && quest.type === 'craft_count') {
      quest.progress++;
    }
    if (type === 'craft_complete' && quest.type === 'craft_quality') {
      const tierOrder = ['Basic','Standard','Superior','Mastercraft'];
      const minIdx = tierOrder.indexOf(quest.requirement.minTier);
      const craftedIdx = tierOrder.indexOf(data?.qualityTier);
      if (craftedIdx >= minIdx) quest.progress++;
    }

    // Check completion
    if (quest.progress >= quest.target && !quest.completed) {
      completeQuest(quest);
    }
  }
}

function renderQuestAreaInDialogue(npcName) {
  const area = document.getElementById('dialogueQuestArea');
  if (!area) return;
  if (!G.quests) G.quests = { active: [], completed: [] };

  let html = '';

  // Daily quest section
  const activeQuest = getActiveQuestForNpc(npcName);
  const completedToday = isQuestCompletedToday(npcName);

  if (activeQuest) {
    const pct = Math.min(100, Math.floor(activeQuest.progress / activeQuest.target * 100));
    html += `<div class="quest-item" style="text-align:left;">
      <span class="quest-title">${activeQuest.title}</span>
      <div class="quest-desc">${activeQuest.desc}</div>
      <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      <div class="quest-reward">Progress: ${activeQuest.progress}/${activeQuest.target} | Reward: ${activeQuest.reward.coins} coins${activeQuest.reward.title ? ' + "' + activeQuest.reward.title + '"' : ''}${activeQuest.reward.rewardItem ? ' + Spirit Trap' : ''}</div>
    </div>`;
  } else if (completedToday) {
    html += `<div style="font-size:12px;color:#666;font-style:italic;margin-top:8px;">No more quests today. Come back tomorrow.</div>`;
  } else {
    const quest = getNpcDailyQuest(npcName);
    if (quest) {
      html += `<div class="quest-item" style="text-align:left;">
        <span class="quest-title">Quest: ${quest.title}</span>
        <div class="quest-desc">${quest.desc}</div>
        <div class="quest-reward">Reward: ${quest.reward.coins} coins${quest.reward.title ? ' + "' + quest.reward.title + '"' : ''}${quest.reward.rewardItem ? ' + Spirit Trap' : ''}</div>
        <button class="quest-accept-btn" onclick="acceptQuest('${npcName}')">Accept Quest</button>
      </div>`;
    }
  }

  // Gathering quest section (region NPCs only)
  const gq = NPC_GATHERING_QUESTS[npcName];
  if (gq) {
    if (!G.gatheringQuests) G.gatheringQuests = {};
    const accepted = G.gatheringQuests[npcName]?.accepted;
    const have = getGatheringQuestStock(npcName);
    if (accepted) {
      const canComplete = have >= gq.qty;
      html += `<div class="quest-item" style="text-align:left;border-left:3px solid #6a8;">
        <span class="quest-title" style="color:#6a8;">Gathering: ${gq.itemName}</span>
        <div class="quest-desc">${gq.desc} (Have: ${have}/${gq.qty})</div>
        <div class="quest-reward">Reward: ${gq.reward} coins</div>
        ${canComplete ? `<button class="quest-accept-btn" style="background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);color:#6a8;" onclick="completeGatheringQuest('${npcName}')">Turn In</button>` : '<div style="font-size:11px;color:#666;margin-top:4px;">Gather the materials and return.</div>'}
      </div>`;
    } else {
      html += `<div class="quest-item" style="text-align:left;border-left:3px solid #6a8;">
        <span class="quest-title" style="color:#6a8;">Gathering: ${gq.itemName}</span>
        <div class="quest-desc">${gq.desc}</div>
        <div class="quest-reward">Reward: ${gq.reward} coins</div>
        <button class="quest-accept-btn" style="background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);color:#6a8;" onclick="acceptGatheringQuest('${npcName}')">Accept Gathering</button>
      </div>`;
    }
  }

  area.innerHTML = html;
}

function renderQuestsInInventory() {
  const el = document.getElementById('questList');
  if (!el) return;
  if (!G.quests?.active || G.quests.active.length === 0) {
    el.innerHTML = '<p style="color:#555;font-size:12px;">No active quests. Talk to NPCs in the hub!</p>';
    return;
  }
  el.innerHTML = G.quests.active.map(q => {
    const pct = Math.min(100, Math.floor(q.progress / q.target * 100));
    return `<div class="quest-item">
      <span class="quest-title">${q.title}</span> <span class="quest-npc">(${q.npc})</span>
      ${q.completed ? '<span class="quest-complete-badge">Complete!</span>' : ''}
      <div class="quest-desc">${q.desc}</div>
      <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
      <div class="quest-reward">Progress: ${q.progress}/${q.target} | Reward: ${q.reward.coins} coins</div>
    </div>`;
  }).join('');
}

// Track flee count for "no flee" quest (declared in globals.js)
