// NPCS
// NPC data, dialogue, hostile NPCs, Black Riders
// Extracted from index.html — v7.1.0
// All functions and variables remain global.

// ═══════ NPC DATA ═══════
const NPCS = [
  // Polaris (Frost Valley)
  { name: 'Elder Frost', x: HUB.x + 2, y: HUB.y - 1, color: '#daa520', sprite: 'npc_elder' },
  { name: 'Smith Ember', x: HUB.x + 0, y: HUB.y + 5, color: '#e07020', sprite: 'npc_smith' },
  { name: 'Crazy Lou', x: HUB.x + 7, y: HUB.y + 1, color: '#c0a040', sprite: 'npc_zara' },
  // Meadowbrook (Rolling Hills)
  { name: 'Farmer Bea', x: 24, y: 58, color: '#6a8a4a', sprite: 'npc_elder' },
  { name: 'Herbalist Sage', x: 28, y: 60, color: '#4a8a6a', sprite: 'npc_smith' },
  // Volcanic Isles Settlement
  { name: 'Captain Flint', x: 74, y: 16, color: '#cc6644', sprite: 'npc_zara' },
  { name: 'Lava Tender', x: 76, y: 14, color: '#ff8844', sprite: 'npc_smith' },
  // Dark Castle Outpost
  { name: 'Shadow Warden', x: 93, y: 20, color: '#8a6aaa', sprite: 'npc_zara' },
  { name: 'Cursed Scholar', x: 95, y: 22, color: '#6a4a8a', sprite: 'npc_elder' },
];

// ═══════ TILE MAP (Frost Valley) ═══════

// ═══════ NPC DIALOGUE DATA ═══════

function getElderFrostDialogue() {
  const cycleId = getZoneCycleId();
  // Find the best and worst zones
  let bestIdx = 0, worstIdx = 0, bestQ = 0, worstQ = 2;
  for (let i = 0; i < ENCOUNTER_ZONES.length; i++) {
    const q = getZoneQuality(i, cycleId);
    if (q > bestQ) { bestQ = q; bestIdx = i; }
    if (q < worstQ) { worstQ = q; worstIdx = i; }
  }
  const bestName = ENCOUNTER_ZONES[bestIdx].name;
  const worstName = ENCOUNTER_ZONES[worstIdx].name;

  const lines = [
    `Oh hey, you again. The ${bestName}'s been putting out some real quality essences lately. Might want to check it out.`,
    `Another warden tried to sell me a Basic Frost Blaster yesterday. I said "friend, I wouldn't put that on a Puff." Ha!`,
    `You know what separates a good crafter from a great one? Patience. Wait for the right spawn.`,
    `Heard the ${worstName}'s quality dropped this cycle. I'd skip it if I were you.`,
    `The ${bestName} is running hot right now. If you're grinding essences, that's your spot.`,
    `Back in my day we didn't have zone reports. You had to walk to every field and just... feel the energy. Kids these days.`,
    `You found a lore tablet? Good. The young ones need to know where we came from.`,
    `The Dark Castle... don't ask me about the Dark Castle. Some doors should stay sealed.`,
    `Polaris wasn't always called that. We renamed it after the first star appeared in the Spirit Sky.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getSmithEmberDialogue() {
  const lines = [
    `Most wardens just throw any old essences in and hope for the best. That's how you get Basic gear.`,
    `Pro tip: Purity is everything in experimentation. High purity means your experiments actually stick.`,
    `I've been smithing for years and I still get nervous on the experiment roll. That's the thrill though.`,
    `You want Mastercraft? Get your mastery up. A Novice gets lucky sometimes. A Master gets consistent.`,
    `The experiment gamble is where the magic happens. High risk, high reward. Don't be afraid to roll.`,
    `Every piece of gear tells a story. Who made it, what essences went in, how the experiments landed. That's craft.`,
    `Iron from the mountain pass makes the strongest frames. Worth the dangerous trip.`,
    `A Frost Infusion and a Flame Core in the same item? That's ambitious. I like it.`,
    `The old Wardens didn't have workshops. They crafted in the field with their bare hands.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getCrazyLouDialogue() {
  // After a few normal lines, Crazy Lou summons Valkin
  if (!getCrazyLouDialogue._visitCount) getCrazyLouDialogue._visitCount = 0;
  getCrazyLouDialogue._visitCount++;

  // On the 3rd talk, she summons Valkin
  if (getCrazyLouDialogue._visitCount === 3 && typeof EventEngine !== 'undefined' && typeof VALKIN_SCRIPT !== 'undefined') {
    if (typeof window._worldScene !== 'undefined' && window._worldScene && !EventEngine.isActive('valkin_the_grand')) {
      setTimeout(() => EventEngine.start(VALKIN_SCRIPT, window._worldScene), 2000);
      return `Be on guard, word has it Valkin approaches.`;
    }
  }

  const lines = [
    `...you smell that? Smoke. But there's no fire.`,
    `I used to have a team. Full roster. Gone now.`,
    `Don't go past the hills at night. Just don't.`,
    `Something's wrong with the spirits lately. They won't look at me.`,
    `I've been out here too long. But somebody's gotta watch.`,
    `You remind me of someone. Forget it.`,
    `The ground shakes sometimes. Nobody talks about it.`,
    `Stay close to the hub. Trust me on that.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── Meadowbrook (Rolling Hills) NPCs ──
function getFarmerBeaDialogue() {
  const lines = [
    `The hills have been good this season. Plenty of essences in the meadows.`,
    `Watch out past the flower fields. The Spiritkin get aggressive out there.`,
    `Meadowbrook might be small, but we've got the best Healing Seeds in the Overworld.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getHerbalistSageDialogue() {
  const lines = [
    `I've been studying the properties of different essence subtypes. Fascinating work.`,
    `Sun Essences from the Sunlit Meadow have the highest Purity I've ever seen.`,
    `Need something crafted? The workshop in Polaris is still the best, but I can teach you about herbs.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── Volcanic Isles Settlement NPCs ──
function getCaptainFlintDialogue() {
  const lines = [
    `Welcome to the Isles. Beautiful, isn't it? Don't let the lava fool you — this is paradise.`,
    `The Magma Pools have the best Potency essences in the world. Worth the trip.`,
    `Nerina lives deep in the waters. She's not hostile — she's mourning.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getLavaTenderDialogue() {
  const lines = [
    `I keep the lava channels clear. Without me, this whole settlement would be underwater... or under lava.`,
    `Flame Cores from here are the purest. Every Blacksmith wants our materials.`,
    `The eruption that split the land? I wasn't there, but the obsidian remembers.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

// ── Dark Castle Outpost NPCs ──
function getShadowWardenDialogue() {
  const lines = [
    `You made it through the passage. Brave. Or foolish. Time will tell.`,
    `Valkin's castle is not empty. His power echoes in the walls.`,
    `The Spiritkin here are different. Darker. Angrier. Be ready.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getCursedScholarDialogue() {
  const lines = [
    `I study the curse that lingers here. Valkin's magic is... remarkable, in a terrible way.`,
    `The Fragment you seek — yes, I know about the Mask of Destiny. Everyone here does.`,
    `Leon was here once. I saw his spirit pass through. He was heading toward the castle.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

const NPC_DIALOGUE_MAP = {
  'Elder Frost': { getLine: getElderFrostDialogue, portrait: '&#129461;', portraitBg: '#3a2a10' },
  'Smith Ember': { getLine: getSmithEmberDialogue, portrait: '&#128296;', portraitBg: '#3a1a0a' },
  'Crazy Lou': { getLine: getCrazyLouDialogue, portrait: '&#129322;', portraitBg: '#2a2a1a' },
  'Farmer Bea': { getLine: getFarmerBeaDialogue, portrait: '&#127806;', portraitBg: '#2a3a1a' },
  'Herbalist Sage': { getLine: getHerbalistSageDialogue, portrait: '&#127807;', portraitBg: '#1a3a2a' },
  'Captain Flint': { getLine: getCaptainFlintDialogue, portrait: '&#9875;', portraitBg: '#3a1a0a' },
  'Lava Tender': { getLine: getLavaTenderDialogue, portrait: '&#128293;', portraitBg: '#3a1a00' },
  'Shadow Warden': { getLine: getShadowWardenDialogue, portrait: '&#128481;&#65039;', portraitBg: '#1a0a2a' },
  'Cursed Scholar': { getLine: getCursedScholarDialogue, portrait: '&#128214;', portraitBg: '#2a1a3a' },
};


// ═══════ HOSTILE NPCs (Trainer Battles) ═══════
const HOSTILE_NPCS = [
  { id: 'brawler_jax', name: 'Brawler Jax', x: 30, y: 20,
    team: [34, 5, 48],
    challenge: "Hey! You think you can just walk through MY territory?",
    defeated: "Alright, alright. You're pretty good. Name's Jax.",
    dialogue: ["I used to think I was the toughest in Frost Valley. Then you showed up.", "Watch out near the frozen lake — the ice spirits are no joke."],
    sprite: 'npc_zara', color: '#c44' },
  { id: 'ice_queen', name: 'Ice Queen Vera', x: 40, y: 15,
    team: [81, 29, 86],
    challenge: "You dare enter MY domain? Prepare yourself!",
    defeated: "Hmph. You have skill. I'll remember that.",
    dialogue: ["The Crystal Glade is sacred. I protect it.", "Frost essences are the purest — don't waste them on bad schematics."],
    sprite: 'npc_elder', color: '#68c' },
  { id: 'bandit_marcus', name: 'Bandit Marcus', x: 28, y: 48,
    team: [43, 60, 93],
    challenge: "Hand over your coins or fight for 'em!",
    defeated: "Fine, you win. I was going straight anyway...",
    dialogue: ["I used to rob travelers on this path. Now I just give directions.", "Meadowbrook has better prices than Polaris. Just saying."],
    sprite: 'npc_smith', color: '#a84' },
  { id: 'lava_raider', name: 'Lava Raider Kira', x: 68, y: 25,
    team: [304, 336, 209],
    challenge: "Fresh meat from the cold lands! Let's see what you've got!",
    defeated: "Ha! Not bad for a snowbird. Welcome to the Isles.",
    dialogue: ["The lava rivers carry Volcanic Glass. Worth more than gold.", "Nerina swims deep. I've seen her shadow. Beautiful and terrifying."],
    sprite: 'npc_zara', color: '#e84' },
  { id: 'shadow_knight', name: 'Shadow Knight Vex', x: 92, y: 18,
    team: [202, 78, 108],
    challenge: "None shall pass without proving their worth to the Dark Castle.",
    defeated: "You've earned passage. But Valkin's castle... be ready.",
    dialogue: ["I guard this passage. The weak don't survive what's inside.", "The Cursed Scholar knows more than he lets on. Press him."],
    sprite: 'npc_elder', color: '#86a' },
  { id: 'the_exile', name: 'The Exile', x: 55, y: 35,
    team: [97, 113, 110],
    challenge: "...",
    defeated: "You see beyond strength. That is rare.",
    dialogue: ["I was once Valkin's lieutenant. I left when I saw what the curse did to Leon.", "The Mask of Destiny... I've seen it work. Once. A long time ago."],
    sprite: 'npc_smith', color: '#666' },
];

function isHostileNPCDefeatedToday(npcId) {
  if (!G.hostileNPCsDefeated) G.hostileNPCsDefeated = {};
  return G.hostileNPCsDefeated[npcId] === getDaySeed();
}

function markHostileNPCDefeated(npcId) {
  if (!G.hostileNPCsDefeated) G.hostileNPCsDefeated = {};
  G.hostileNPCsDefeated[npcId] = getDaySeed();
  saveGame();
}

function triggerHostileNPCBattle(npc) {
  if (G.inBattle || G.team.length === 0) return;
  // Close any open UI overlays before battle
  document.querySelectorAll('.modal-overlay.active, #npcDialogueBox').forEach(el => { if (el.id === 'npcDialogueBox') el.style.display='none'; else el.classList.remove('active'); });


  // Star Fox-style challenge comm
  if (typeof showComm === 'function') {
    showComm(npc.name, npc.challenge, { persist: false, speed: 25, duration: 2500 });
  } else {
    notify(npc.challenge);
  }
  G.inBattle = true;
  SFX.encounterStart();
  Music.play('battle');

  const playerGhosts = buildPlayerBattleTeam();
  // Scale trainer team size by region (early = fewer ghosts)
  const trainerRegion = (typeof getCurrentRegion === 'function') ? getCurrentRegion(G.x, G.y) : 'frost_valley';
  const trainerTeamSize = {
    frost_valley: 1,
    rolling_hills: 2,
    volcanic_isles: 2,
    dark_castle: 3,
  }[trainerRegion] || 3;

  const trainerCardIds = npc.team.slice(0, trainerTeamSize);
  const enemyGhosts = trainerCardIds.map(id => {
    const card = getCard(id);
    if (!card) return null;
    return {
      id: card.id, name: card.name, hp: card.maxHp, maxHp: card.maxHp, ko: false,
      ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
      usedOncePerGame: false, entryFired: false
    };
  }).filter(Boolean);

  if (enemyGhosts.length === 0) { G.inBattle = false; return; }

  // Scale enemy HP
  for (const eg of enemyGhosts) {
    if (G.level <= 3) { eg.maxHp = Math.max(2, eg.maxHp - 1); eg.hp = eg.maxHp; }
    else if (G.level >= 7) { eg.maxHp += 1; eg.hp = eg.maxHp; }
  }

  B = {
    round: 1,
    player: {
      ghosts: playerGhosts, activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemy: {
      ghosts: enemyGhosts, activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemyCard: getCard(npc.team[0]),
    enemyCards: npc.team.map(id => getCard(id)).filter(Boolean),
    log: [], phase: 'ready', playerDice: [], enemyDice: [],
    entryFired: false,
    resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    isAggressive: true,
    isHostileNPC: npc.id,
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    enemyUsedResource: false, damageTakenThisRound: 0, koSwapTeam: null,
  };

  applyAccessoryBattleEffects();

  showBattleOverlay();
  document.getElementById('battleTitle').textContent = `${npc.name} challenges you!`;
  renderBattle();
}

// Check hostile NPC proximity every frame (called from gameLoop)
function checkHostileNPCProximity() {
  if (G.inBattle) return;
  for (const npc of HOSTILE_NPCS) {
    if (isHostileNPCDefeatedToday(npc.id)) continue;
    const dist = Math.sqrt((G.x - npc.x) ** 2 + (G.y - npc.y) ** 2);
    if (dist < 1.5) { // reduced from 3 — player must walk close, not just pass nearby
      triggerHostileNPCBattle(npc);
      return;
    }
  }
}

// ═══════ BLACK RIDERS (Night Path Patrols) ═══════
const BLACK_RIDERS = [];
const BLACK_RIDER_MAX = 1;
const BLACK_RIDER_SPAWN_INTERVAL = 60 * 60 * 1000; // one every hour
const BLACK_RIDER_LIFESPAN = 2 * 60 * 1000; // despawn after 2 minutes

function spawnBlackRiders() {
  if (BLACK_RIDERS.length >= BLACK_RIDER_MAX) return;
  const tod = getTimeOfDay();
  if (tod.phase !== 'night') return;

  for (let attempt = 0; attempt < 20; attempt++) {
    const rx = 5 + Math.floor(Math.random() * (WORLD_W - 10));
    const ry = 5 + Math.floor(Math.random() * (WORLD_H - 10));
    if (worldMap[ry]?.[rx] !== 2) continue;
    const dFH = Math.sqrt((rx-(HUB.x+3))**2+(ry-(HUB.y+3))**2);
    if (dFH < 12) continue;
    const dPlayer = Math.sqrt((rx - G.x)**2 + (ry - G.y)**2);
    if (dPlayer < 10) continue;

    BLACK_RIDERS.push({
      id: Date.now() + Math.random(),
      x: rx, y: ry,
      speed: 0.04,
      chaseSpeed: 0.06,
      detectRange: 8,
      state: 'patrol',
      angle: Math.random() * Math.PI * 2,
      team: [202, 111, 108],
      spawnedAt: Date.now(),
      particles: [],
    });
    break;
  }
}
setInterval(spawnBlackRiders, BLACK_RIDER_SPAWN_INTERVAL);

function despawnBlackRidersAtDawn() {
  // Despawn riders that have been alive > 2 minutes
  const now = Date.now();
  for (let i = BLACK_RIDERS.length - 1; i >= 0; i--) {
    if (BLACK_RIDERS[i].spawnedAt && now - BLACK_RIDERS[i].spawnedAt > BLACK_RIDER_LIFESPAN) {
      BLACK_RIDERS.splice(i, 1);
    }
  }
  // Also despawn at dawn
  const tod = getTimeOfDay();
  if (tod.phase === 'dawn' && BLACK_RIDERS.length > 0) {
    BLACK_RIDERS.length = 0;
    notify('The Black Riders retreat with the sunrise...');
  }
}

function updateBlackRiders() {
  despawnBlackRidersAtDawn();
  if (G.inBattle) return;

  for (let i = BLACK_RIDERS.length - 1; i >= 0; i--) {
    const r = BLACK_RIDERS[i];
    const dist = Math.sqrt((G.x - r.x) ** 2 + (G.y - r.y) ** 2);

    // State transitions
    if (dist < r.detectRange && r.state !== 'chase') {
      r.state = 'chase';
    } else if (dist > r.detectRange + 4 && r.state === 'chase') {
      r.state = 'patrol';
    }

    if (r.state === 'chase') {
      // Chase: move directly toward player (ignore path constraint)
      const dx = G.x - r.x;
      const dy = G.y - r.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0) {
        r.x += (dx / len) * r.chaseSpeed;
        r.y += (dy / len) * r.chaseSpeed;
      }
      // Catch player
      if (dist < 1.5) {
        triggerBlackRiderBattle(r);
        BLACK_RIDERS.splice(i, 1);
        return;
      }
    } else {
      // Patrol: follow paths (tile 2)
      const nextX = r.x + Math.cos(r.angle) * r.speed;
      const nextY = r.y + Math.sin(r.angle) * r.speed;
      const nextTile = worldMap[Math.floor(nextY)]?.[Math.floor(nextX)];
      if (nextTile === 2) {
        r.x = nextX;
        r.y = nextY;
      } else {
        // Try to find a path tile nearby
        let found = false;
        for (let a = 0; a < 8; a++) {
          const tryAngle = r.angle + (a * Math.PI / 4);
          const tx = r.x + Math.cos(tryAngle) * r.speed;
          const ty = r.y + Math.sin(tryAngle) * r.speed;
          if (worldMap[Math.floor(ty)]?.[Math.floor(tx)] === 2) {
            r.angle = tryAngle;
            r.x = tx;
            r.y = ty;
            found = true;
            break;
          }
        }
        if (!found) r.angle += Math.PI; // reverse
      }
    }

    // Shadow/smoke particles
    if (Math.random() < 0.3) {
      r.particles.push({
        x: r.x + (Math.random() - 0.5) * 0.5,
        y: r.y + (Math.random() - 0.5) * 0.5,
        life: 1.0,
      });
    }
    for (let p = r.particles.length - 1; p >= 0; p--) {
      r.particles[p].life -= 0.03;
      if (r.particles[p].life <= 0) r.particles.splice(p, 1);
    }

    // Despawn if very far from player
    if (dist > 50) {
      BLACK_RIDERS.splice(i, 1);
    }
  }
}

function triggerBlackRiderBattle(rider) {
  if (G.inBattle || G.team.length === 0) return;

  notify('A Black Rider has caught you!');
  G.inBattle = true;
  SFX.encounterStart();
  Music.play('battle');

  const playerGhosts = buildPlayerBattleTeam();
  const enemyGhosts = rider.team.map(id => {
    const card = getCard(id);
    if (!card) return null;
    return {
      id: card.id, name: card.name, hp: card.maxHp, maxHp: card.maxHp, ko: false,
      ability: card.ability, abilityDesc: card.desc, rarity: card.rarity,
      usedOncePerGame: false, entryFired: false
    };
  }).filter(Boolean);

  if (enemyGhosts.length === 0) { G.inBattle = false; return; }

  // Scale enemy HP — Black Riders are tough
  for (const eg of enemyGhosts) {
    eg.maxHp += 2;
    eg.hp = eg.maxHp;
  }

  B = {
    round: 1,
    player: {
      ghosts: playerGhosts, activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemy: {
      ghosts: enemyGhosts, activeIdx: 0,
      resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    },
    enemyCard: getCard(rider.team[0]),
    enemyCards: rider.team.map(id => getCard(id)).filter(Boolean),
    log: [], phase: 'ready', playerDice: [], enemyDice: [],
    entryFired: false,
    resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 },
    isAggressive: true,
    isBlackRider: true,
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    enemyUsedResource: false, damageTakenThisRound: 0, koSwapTeam: null,
  };

  applyAccessoryBattleEffects();

  showBattleOverlay();
  document.getElementById('battleTitle').textContent = 'A Black Rider attacks!';
  renderBattle();
}

// ═══════ NPC DIALOGUE SYSTEM ═══════

function showNPCSpeechBubble(npc, text) {
  const shortText = text.length > 30 ? text.substring(0, 30) + '...' : text;
  npc._speechBubble = { text: shortText, until: Date.now() + 3000 };
}

function showDialogue(npcName) {
  const data = NPC_DIALOGUE_MAP[npcName];
  if (!data) return;

  // Close any existing dialogue before showing new one (allows replacement without click)
  clearTimeout(window._dialogueAutoClose);
  const overlay = document.getElementById('dialogueOverlay');
  if (overlay.classList.contains('active')) {
    // Already showing — just replace content directly
  }

  const line = data.getLine();
  document.getElementById('dialoguePortrait').innerHTML = data.portrait;
  document.getElementById('dialoguePortrait').style.background = data.portraitBg;
  document.getElementById('dialogueNpcName').textContent = npcName;
  document.getElementById('dialogueText').textContent = line;
  renderQuestAreaInDialogue(npcName);
  overlay.classList.add('active');

  // Show speech bubble on the overworld NPC too
  const npc = NPCS.find(n => n.name === npcName);
  if (npc) showNPCSpeechBubble(npc, line);

  // Auto-dismiss after 6 seconds
  window._dialogueAutoClose = setTimeout(() => {
    closeDialogue();
  }, 6000);
}

function closeDialogue() {
  clearTimeout(window._dialogueAutoClose);
  document.getElementById('dialogueOverlay').classList.remove('active');
}

