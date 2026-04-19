// ══════════════════════════════════════════════════════════════════════════════
// PRESENCE — UI rendering, animations, screens, effects, sound
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Clean up VS winner classes when leaving win screen
  if (id !== 'winScreen') {
    const ws = document.getElementById('winScreen');
    if (ws) ws.classList.remove('vs-blue-wins', 'vs-red-wins');
  }
}

// ══════════════════════════════════════════════
// TITLE SCREEN
// ══════════════════════════════════════════════
function initTitle() {
  const saved = loadState();
  const btn = document.getElementById('continueBtn');
  if (saved && saved.runActive) {
    btn.classList.add('ready');
  } else {
    btn.classList.remove('ready');
  }
  // Show Hall of Fame button if any entries exist
  const hofBtn = document.getElementById('hofBtn');
  hofBtn.style.display = getHallOfFame().length > 0 ? 'block' : 'none';
}

// ══════════════════════════════════════════════
// INITIAL PICK
// ══════════════════════════════════════════════
let pickOptions = [];
let pickSelection = null;

function showInitialPick() {
  showScreen('pickScreen');
  pickSelection = null;
  revealedCards = new Set();
  pickCardNaturalCenters = []; // reset so we re-measure fresh
  document.getElementById('pickBtn').classList.remove('ready');
  document.getElementById('selectedInfo').classList.remove('visible');

  const grid = document.getElementById('ghostGrid');
  grid.innerHTML = '';

  if (state.isRestart) {
    document.getElementById('pickLabel').textContent = 'Choose Your Spiritkin';
    // On restart: 1 common, 1 uncommon, 1 rare (random)
    const commons = ALL_GHOSTS.filter(g => g.rarity === 'common' && !state.usedCards.includes(g.name));
    const uncommons = ALL_GHOSTS.filter(g => g.rarity === 'uncommon' && !state.usedCards.includes(g.name));
    const rares = ALL_GHOSTS.filter(g => g.rarity === 'rare' && !state.usedCards.includes(g.name));
    pickOptions = [
      commons[Math.floor(Math.random() * commons.length)],
      uncommons[Math.floor(Math.random() * uncommons.length)],
      rares[Math.floor(Math.random() * rares.length)]
    ];
  } else {
    document.getElementById('pickLabel').textContent = 'Choose Your Spiritkin';
    // Fixed starters: Dream Cat, Outlaw, Wim
    pickOptions = STARTER_NAMES.map(name => ALL_GHOSTS.find(g => g.name === name));
  }

  const labels = ['?', '?', '?'];
  pickOptions.forEach((g, i) => {
    const c = document.createElement('div');
    c.className = 'pick-card facedown';
    c.innerHTML = `
      <div class="card-back"><img class="card-back-img" src="${CARDBACK}" alt=""><div class="card-back-text">Tap to Reveal</div></div>
      <div class="rarity-badge ${g.rarity}">${g.rarity === 'ghost-rare' ? 'LEGEND' : g.rarity === 'legendary' ? 'LEGEND' : g.rarity.toUpperCase()}</div>
      <img src="${IMG}${g.file}" alt="${g.name}">
      <div class="pick-name">${g.name}</div>
      <div class="pick-ability">${g.ability} · ${g.maxHp} HP</div>
    `;
    c.onclick = () => revealAndSelect(i);
    grid.appendChild(c);
  });

  document.getElementById('pickLabel').innerHTML = state.isRestart
    ? 'Choose Your Spiritkin<br><span style="font-size:0.85rem;color:rgba(255,255,255,0.35);letter-spacing:2px;font-family:Creepster,cursive;">Tap a card to reveal it</span>'
    : 'Choose Your Spiritkin<br><span style="font-size:0.85rem;color:rgba(255,255,255,0.35);letter-spacing:2px;font-family:Creepster,cursive;">Tap a card to reveal it</span>';
}

let revealedCards = new Set();

function revealAndSelect(idx) {
  const cards = document.querySelectorAll('#ghostGrid .pick-card');
  const card = cards[idx];

  // If not revealed yet, reveal it
  if (!revealedCards.has(idx)) {
    revealedCards.add(idx);
    card.classList.remove('facedown');
    card.classList.add('revealed');
    playSfx('sfxSpecial', 0.6);

    // Select after burst animation
    setTimeout(() => selectPickCard(idx), 300);
    return;
  }

  // Already revealed — just select
  selectPickCard(idx);
}

// Natural card centers — measured once before any transforms applied
let pickCardNaturalCenters = [];

function measurePickCards() {
  const cards = document.querySelectorAll('#ghostGrid .pick-card');
  if (!cards.length) return;
  // Temporarily strip transforms to read natural positions
  cards.forEach(c => { c.style.transition = 'none'; c.style.transform = 'none'; });
  void cards[0].offsetHeight; // force reflow
  pickCardNaturalCenters = Array.from(cards).map(c => {
    const r = c.getBoundingClientRect();
    return r.left + r.width / 2;
  });
  // Restore transitions (clear inline overrides)
  cards.forEach(c => { c.style.transform = ''; c.style.transition = ''; });
}

function selectPickCard(idx) {
  pickSelection = idx;
  const cards = document.querySelectorAll('#ghostGrid .pick-card');
  const centerIdx = 1;

  // Measure natural positions once
  if (pickCardNaturalCenters.length === 0) measurePickCards();

  const cardOffset = pickCardNaturalCenters.length >= 2
    ? pickCardNaturalCenters[1] - pickCardNaturalCenters[0]
    : 0;

  cards.forEach((c, i) => {
    if (revealedCards.has(i)) {
      c.classList.remove('facedown');
      c.classList.toggle('selected', i === idx);
      c.classList.toggle('dimmed', i !== idx && revealedCards.has(i));
    }

    // Slide: selected → center, center → selected's old slot, others stay
    if (i === idx) {
      const tx = (centerIdx - i) * cardOffset;
      c.style.transform = `translateX(${tx}px) translateY(-10px) scale(1.08)`;
    } else if (i === centerIdx && idx !== centerIdx) {
      const tx = (idx - centerIdx) * cardOffset;
      c.style.transform = `translateX(${tx}px) scale(0.94)`;
    } else {
      c.style.transform = 'scale(0.94)';
    }
  });

  const g = pickOptions[idx];
  const nameEl = document.getElementById('siName');
  nameEl.textContent = g.name;

  // Rarity-based name color
  const rarityColors = {
    common: '#9ca3af',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    'ghost-rare': '#fbbf24',
    legendary: '#c084fc'
  };
  const rarityGlows = {
    common: 'rgba(156,163,175,0.3)',
    uncommon: 'rgba(74,222,128,0.3)',
    rare: 'rgba(96,165,250,0.4)',
    'ghost-rare': 'rgba(251,191,36,0.4)',
    legendary: 'rgba(192,132,252,0.4)'
  };
  nameEl.style.color = rarityColors[g.rarity] || '#e0e0e0';
  nameEl.style.textShadow = `0 0 20px ${rarityGlows[g.rarity] || 'rgba(255,255,255,0.3)'}`;

  document.getElementById('siAbilityName').textContent = g.ability;
  document.getElementById('siDesc').textContent = g.abilityDesc;
  document.getElementById('siHp').textContent = `${g.maxHp} HP`;

  // HP pips — one orb per HP point
  const pipWrap = document.getElementById('siHpPips');
  pipWrap.innerHTML = '';
  for (let i = 0; i < g.maxHp; i++) {
    const pip = document.createElement('div');
    pip.className = 'si-hp-pip';
    pip.style.animationDelay = (i * 0.06) + 's';
    pipWrap.appendChild(pip);
  }

  document.getElementById('selectedInfo').classList.add('visible');
  document.getElementById('pickBtn').classList.add('ready');
}

function confirmPick() {
  if (pickSelection === null) return;
  const g = { ...pickOptions[pickSelection], hp: pickOptions[pickSelection].maxHp };
  state.collection.push(g);
  state.usedCards.push(g.name);
  saveState();
  // First pick → straight into boss 1 battle
  if (state.currentBoss === 0 && state.collection.length === 1) {
    selectedGhostIndex = 0;
    startBattle();
  } else {
    showMap();
  }
}

// ══════════════════════════════════════════════
// MAP SCREEN
// ══════════════════════════════════════════════
function getStakesText(bossIndex, deadCount, aliveCount) {
  if (bossIndex === 0) return 'Your journey begins...';
  if (bossIndex === 1) return 'The tournament continues.';
  if (bossIndex === 2) return `${bossIndex} challengers defeated.`;
  if (deadCount > 0 && aliveCount <= 2) return `Only ${aliveCount} Spiritkin remain. Tread carefully.`;
  if (deadCount > 0 && aliveCount <= 3) return `${deadCount} fallen. ${aliveCount} still fighting.`;
  if (bossIndex === 8) return 'The legendary trials begin.';
  if (bossIndex === 9) return 'Almost there. Stay focused.';
  if (bossIndex === 10) return 'One more after this.';
  if (bossIndex === 11) return 'The final battle awaits.';
  if (bossIndex >= 5) return `${bossIndex} down, ${12 - bossIndex} to go. The road gets harder.`;
  return `${bossIndex} down, ${12 - bossIndex} to go.`;
}

function showMap() {
  showScreen('mapScreen');
  const boss = BOSSES[state.currentBoss];
  const location = BOSS_LOCATIONS[state.currentBoss] || 'Unknown';
  const theme = LOCATION_THEMES[location] || { bg: 'linear-gradient(180deg, #0a0a1a, #1a1a2a)', accent: '#67e8f9' };

  // Apply theme
  const mapScreen = document.getElementById('mapScreen');
  mapScreen.style.background = theme.bg;
  mapScreen.style.setProperty('--accent', theme.accent);

  // Build progress bar (12 nodes)
  const progress = document.getElementById('tournamentProgress');
  progress.innerHTML = '';
  for (let i = 0; i < BOSSES.length && i < 12; i++) {
    const node = document.createElement('div');
    node.className = 'progress-node';
    if (i < state.currentBoss) node.classList.add('defeated');
    else if (i === state.currentBoss) node.classList.add('current');
    else node.classList.add('upcoming');
    if (i >= 8) node.classList.add('legendary');
    progress.appendChild(node);
  }

  // Fight number
  document.getElementById('fightNumber').textContent = `BATTLE ${state.currentBoss + 1} OF 12`;

  // Location
  document.getElementById('locationBanner').textContent = location;

  // Boss card
  document.getElementById('bossCardShowcase').innerHTML = `<img src="${IMG}${boss.file}">`;

  // Boss name
  document.getElementById('bossNameReveal').textContent = boss.name;

  // Boss HP as pips + text
  const pips = Array(boss.bossHp).fill('<span class="hp-pip"></span>').join('');
  document.getElementById('bossStatsReveal').innerHTML = `<div class="hp-pips">${pips}</div><div class="hp-text">${boss.bossHp} HP</div>`;

  // Ability card
  document.getElementById('bossAbilityCard').innerHTML = `
    <div class="ability-name">${boss.ability}</div>
    <div class="ability-desc">${boss.abilityDesc}</div>
  `;

  // Stakes text
  document.getElementById('stakesText').textContent = getStakesText(state.currentBoss, state.deadGhosts.length, state.collection.length);

  // Team ghosts — selectable for battle
  selectedGhostIndex = 0;
  const teamGhosts = document.getElementById('teamGhosts');
  teamGhosts.innerHTML = '';
  state.collection.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb selectable' + (i === 0 ? ' selected' : '');
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="ghost-hp-tag">${g.hp}/${g.maxHp}</div>`;
    el.onclick = () => {
      selectedGhostIndex = i;
      document.querySelectorAll('.team-ghost-thumb.selectable').forEach((t, j) => t.classList.toggle('selected', j === i));
      const nameEl = document.getElementById('selectedFighterName');
      nameEl.textContent = g.name;
      const rarityColors = { 'common': '#94a3b8', 'uncommon': '#4ade80', 'rare': '#38bdf8', 'ghost-rare': '#c084fc', 'legendary': '#fbbf24' };
      nameEl.style.color = rarityColors[g.rarity] || '#67e8f9';
    };
    teamGhosts.appendChild(el);
  });
  state.deadGhosts.forEach(name => {
    const g = ALL_GHOSTS.find(gh => gh.name === name);
    if (!g) return;
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb dead';
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="dead-x">\u2715</div>`;
    teamGhosts.appendChild(el);
  });

  // Items
  const teamItems = document.getElementById('teamItems');
  teamItems.innerHTML = '';
  (state.items || []).forEach(id => {
    const item = ITEMS[id];
    if (!item) return;
    const el = document.createElement('div');
    el.className = 'team-item-icon';
    el.textContent = item.icon;
    teamItems.appendChild(el);
  });

  // Selected fighter name + rarity color
  if (state.collection.length > 0) {
    const firstGhost = state.collection[0];
    const nameEl = document.getElementById('selectedFighterName');
    nameEl.textContent = firstGhost.name;
    const rarityColors = { 'common': '#94a3b8', 'uncommon': '#4ade80', 'rare': '#38bdf8', 'ghost-rare': '#c084fc', 'legendary': '#fbbf24' };
    nameEl.style.color = rarityColors[firstGhost.rarity] || '#67e8f9';
  }

  // Fight button accent
  document.getElementById('fightBtn').style.borderColor = theme.accent;

  // Trigger entrance animations by adding a class
  mapScreen.classList.remove('map-entered');
  void mapScreen.offsetHeight; // force reflow
  mapScreen.classList.add('map-entered');
}

function renderItemRow() {
  const row = document.getElementById('itemRow');
  row.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    if (state.items[i]) {
      const item = ITEMS[state.items[i]];
      slot.className = 'item-slot';
      slot.innerHTML = `${item.icon}<div class="item-label">${item.name}</div>`;
    } else {
      slot.className = 'item-slot empty';
      slot.innerHTML = `<div class="item-label">Empty</div>`;
    }
    row.appendChild(slot);
  }
}

// ══════════════════════════════════════════════
// PRE-BATTLE
// ══════════════════════════════════════════════
function openPreBattle() {
  if (state.collection.length === 0) return;
  showScreen('prebattleScreen');
  selectedGhostIndex = 0;
  renderPreBattle();
}

function renderPreBattle() {
  const boss = BOSSES[state.currentBoss];
  document.getElementById('pbTitle').textContent = BOSS_LOCATIONS[state.currentBoss] || 'Boss Battle';
  document.getElementById('pbEnemyCard').innerHTML = `<img src="${IMG}${boss.file}">`;
  document.getElementById('pbEnemyName').textContent = boss.name;

  const sel = state.collection[selectedGhostIndex];
  document.getElementById('pbPlayerCard').innerHTML = `<img src="${IMG}${sel.file}">`;
  document.getElementById('pbPlayerName').textContent = sel.name;
  document.getElementById('pbStats').innerHTML = `
    <b>${sel.name}</b>: ${sel.ability} · ${sel.hp}/${sel.maxHp} HP<br>
    <b>${boss.name}</b>: ${boss.ability} · ${boss.bossHp} HP
  `;

  // Ghost selection
  const selectDiv = document.getElementById('pbGhostSelect');
  selectDiv.innerHTML = '';
  state.collection.forEach((g, i) => {
    const opt = document.createElement('div');
    opt.className = 'pb-ghost-opt' + (i === selectedGhostIndex ? ' selected' : '');
    opt.innerHTML = `<img src="${IMG}${g.file}" alt="${g.name}"><div class="opt-hp">${g.hp}/${g.maxHp}</div>`;
    opt.onclick = () => { selectedGhostIndex = i; renderPreBattle(); };
    selectDiv.appendChild(opt);
  });

  document.getElementById('pbFightBtn').classList.add('ready');
}

// ══════════════════════════════════════════════
// SFX
// ══════════════════════════════════════════════
function playSfx(id, vol = 0.8) {
  const s = document.getElementById(id);
  if (!s) return;
  s.currentTime = 0;
  s.volume = Math.min(vol, 1.0);
  s.play().catch(() => {});
}

function playDamageSfx(dmg) {
  if (dmg >= 3) playSfx('sfx3Damage');
  else if (dmg === 2) playSfx('sfx2Damage');
  else playSfx('sfx1Damage');
}

// ══════════════════════════════════════════════
// HP / DICE / NARRATOR
// ══════════════════════════════════════════════
function updateHpDisplay() {
  const ePct = Math.max(0, enemyHp / enemy.bossHp * 100);
  const pPct = Math.max(0, playerHp / pick.maxHp * 100);
  const eBar = document.getElementById('enemyHpBar');
  const pBar = document.getElementById('playerHpBar');
  eBar.style.width = Math.min(ePct, 100) + '%';
  pBar.style.width = Math.min(pPct, 100) + '%';
  eBar.classList.toggle('hp-low', ePct <= 50 && ePct > 25);
  eBar.classList.toggle('hp-critical', ePct <= 25);
  pBar.classList.toggle('hp-low', pPct <= 50 && pPct > 25);
  pBar.classList.toggle('hp-critical', pPct <= 25);
  // Overclocked: green glow when above max HP
  pBar.classList.toggle('hp-over', pPct > 100);
  document.getElementById('enemyHpText').textContent = `${Math.max(0,enemyHp)} / ${enemy.bossHp}`;
  document.getElementById('playerHpText').textContent = `${Math.max(0,playerHp)} / ${pick.maxHp}`;
}

function resetDice() {
  for (let i = 0; i < 7; i++) {
    ['eDie','pDie'].forEach(p => {
      const d = document.getElementById(p+i);
      if (!d) return;
      d.textContent = '';
      d.className = d.className.replace(/ visible| glow| triples-glow| rolling| rerollable| discarded/g, '');
    });
  }
}

function narrate(html) {
  document.getElementById('narrator').innerHTML = html;
  // Mirror to red narrator in VS mode
  if (vsMode) {
    const rn = document.getElementById('redNarrator');
    if (rn) rn.innerHTML = html;
  }
}

// ══════════════════════════════════════════════
// BATTLE ITEMS UI
// ══════════════════════════════════════════════
let abilityUsedThisBattle = false; // for once-per-battle abilities like Bogey

function renderBattleActionBar() {
  const container = document.getElementById('battleActionBar');
  container.innerHTML = '';

  // Top row: ability icon + items
  const topRow = document.createElement('div');
  topRow.className = 'action-row';

  // Activatable ability icon
  const abilityId = pick ? pick.ability : null;
  const hasActivatable = ['Teamwork', 'Heating Up', 'Bogus', 'Change of Heart'].includes(abilityId);
  if (hasActivatable) {
    const ab = document.createElement('div');
    ab.className = 'ability-icon';
    ab.id = 'abilityBtn';
    let icon = '\u2728';
    if (abilityId === 'Teamwork') icon = '\u{1F91D}';
    if (abilityId === 'Heating Up') icon = '\u{1F525}';
    if (abilityId === 'Bogus') icon = '\u{1F6E1}\uFE0F';
    if (abilityId === 'Change of Heart') icon = '\u{1F504}';
    let label = abilityId.split(' ')[0];
    if (abilityId === 'Bogus' && bogeyReflectArmed) label = 'ARMED';
    if (abilityId === 'Bogus' && bogeyReflectUsed) label = 'USED';
    if (abilityId === 'Change of Heart') label = 'Swap';
    ab.innerHTML = `${icon}<div class="icon-label">${label}</div>`;
    ab.title = pick.abilityDesc;
    if (abilityId === 'Bogus' && bogeyReflectUsed) ab.classList.add('used');
    ab.onclick = () => activateAbility();
    topRow.appendChild(ab);
  }

  // Items
  battleItemsState.forEach((bi, i) => {
    if (!bi.id) return;
    const item = ITEMS[bi.id];
    const el = document.createElement('div');
    el.className = 'battle-item' + (bi.used ? ' used' : '');
    el.innerHTML = `${item.icon}<div class="icon-label">${item.name}</div>`;
    el.title = item.desc;
    el.onclick = () => activateItem(i);
    topRow.appendChild(el);
  });

  if (topRow.children.length > 0) container.appendChild(topRow);

  // Bottom row: Ice Shards + Sacred Fires (tap to cycle committed count)
  const totalShards = iceShards + committedShards;
  const totalFires = sacredFires + committedFires;
  if (totalShards > 0 || totalFires > 0) {
    const botRow = document.createElement('div');
    botRow.className = 'action-row';

    if (totalShards > 0) {
      const perShard = pick && pick.ability === 'Winter Barrage' ? 2 : 1;
      const shard = document.createElement('div');
      shard.className = 'shard-icon' + (committedShards > 0 ? ' committed' : '');
      shard.id = 'shardBtn';
      const label = committedShards > 0 ? `${committedShards}/${totalShards} \u2694` : `${totalShards}`;
      shard.innerHTML = `<img src="iceshard.png" class="shard-img"><div class="shard-count">${label}</div>`;
      shard.title = committedShards > 0
        ? `${committedShards} committed (+${committedShards*perShard} if you win). Tap to cycle.`
        : `${totalShards} Ice Shard${totalShards>1?'s':''}. Tap to commit before rolling (+${perShard} each if you win).`;
      shard.style.cursor = 'pointer';
      shard.onclick = () => cycleShards();
      botRow.appendChild(shard);
    }

    if (totalFires > 0) {
      const fire = document.createElement('div');
      fire.className = 'shard-icon fire' + (committedFires > 0 ? ' committed' : '');
      fire.id = 'fireBtn';
      const label = committedFires > 0 ? `${committedFires}/${totalFires} \u2694` : `${totalFires}`;
      fire.innerHTML = `<img src="sacredfire.png" class="shard-img"><div class="shard-count">${label}</div>`;
      fire.title = committedFires > 0
        ? `${committedFires} committed (+${committedFires*3} if you win). Tap to cycle.`
        : `${totalFires} Sacred Fire${totalFires>1?'s':''}. Tap to commit before rolling (+3 each if you win).`;
      fire.style.cursor = 'pointer';
      fire.onclick = () => cycleFires();
      botRow.appendChild(fire);
    }

    container.appendChild(botRow);
  }
  // Also render Red action bar in VS mode
  if (vsMode) renderRedActionBar();
}

function updateItemUsability() {
  // Items
  const items = document.querySelectorAll('#battleActionBar .battle-item');
  items.forEach((el, idx) => {
    // Find the actual battleItemsState index for this element
    let stateIdx = -1;
    let itemCount = 0;
    for (let i = 0; i < battleItemsState.length; i++) {
      if (battleItemsState[i].id) {
        if (itemCount === idx) { stateIdx = i; break; }
        itemCount++;
      }
    }
    const bi = battleItemsState[stateIdx];
    if (!bi || bi.used) return;
    let usable = false;
    if (bi.id === 'heal' && phase >= 1) usable = true;
    if (bi.id === 'power' && phase === 1) usable = true;
    if (bi.id === 'reroll' && phase === 3) usable = true;
    el.classList.toggle('usable', usable);
  });

  // Ability button
  const abBtn = document.getElementById('abilityBtn');
  if (abBtn && pick) {
    let usable = false;
    const abilityPhaseOk = phase === 1 || (vsMode && phase === 0);
    if (pick.ability === 'Teamwork' && abilityPhaseOk) usable = true;
    if (pick.ability === 'Heating Up' && abilityPhaseOk && playerHp > 3) usable = true;
    if (pick.ability === 'Change of Heart' && abilityPhaseOk && iceShards >= 1) usable = true;
    if (pick.ability === 'Bogus' && abilityPhaseOk && !bogeyReflectUsed && !bogeyReflectArmed) usable = true;
    abBtn.classList.toggle('usable', usable);
  }

  // Re-render if shard/fire counts changed (simpler than tracking individually)
  const hasShardIcon = document.querySelector('#battleActionBar .shard-icon:not(.fire)');
  const hasFireIcon = document.querySelector('#battleActionBar .shard-icon.fire');
  if ((iceShards > 0) !== !!hasShardIcon || (sacredFires > 0) !== !!hasFireIcon) {
    renderBattleActionBar();
  } else {
    if (hasShardIcon && iceShards > 0) hasShardIcon.querySelector('.shard-count').textContent = iceShards;
    if (hasFireIcon && sacredFires > 0) hasFireIcon.querySelector('.shard-count').textContent = sacredFires;
  }
  // Also update Red action bar in VS mode
  if (vsMode) updateRedItemUsability();
}

// Cycle committed shards: 0 → 1 → 2 → ... → max → 0
function cycleShards() {
  if (phase !== 1) return;
  const total = iceShards + committedShards;
  if (total <= 0) return;
  // Cycle: add 1 more committed, wrapping back to 0
  committedShards++;
  iceShards--;
  if (committedShards > total) {
    // Wrap: put all back
    iceShards = total;
    committedShards = 0;
  }
  playSfx('sfxSpecial', 0.4);
  const perShard = pick && pick.ability === 'Winter Barrage' ? 2 : 1;
  if (committedShards > 0) {
    narrate(`<b class="gold">${committedShards} Ice Shard${committedShards>1?'s':''} committed!</b> +${committedShards*perShard} if you win.`);
  } else {
    narrate(`Ice Shards uncommitted.`);
  }
  renderBattleActionBar();
}

function cycleFires() {
  if (phase !== 1) return;
  const total = sacredFires + committedFires;
  if (total <= 0) return;
  committedFires++;
  sacredFires--;
  if (committedFires > total) {
    sacredFires = total;
    committedFires = 0;
  }
  playSfx('sfxSpecial', 0.4);
  if (committedFires > 0) {
    narrate(`<b class="gold">${committedFires} Sacred Fire${committedFires>1?'s':''} committed!</b> +${committedFires*3} if you win.`);
  } else {
    narrate(`Sacred Fires uncommitted.`);
  }
  renderBattleActionBar();
}

function activateAbility() {
  if (!pick || phase !== 1) return;

  if (pick.ability === 'Teamwork') {
    playerRemoveDice += 1;
    playerHp += 1; // overclocks past max
    updateHpDisplay();
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="gold">Teamwork!</b> -1 die → +1 HP! (${playerHp}/${pick.maxHp})`);
    renderBattleActionBar();
    updateItemUsability();
  }

  if (pick.ability === 'Heating Up' && playerHp > 3) {
    playerHp -= 2;
    playerBonusDice += 1;
    updateHpDisplay();
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="gold">Heating Up!</b> -2 HP → +1 die this roll!`);
    renderBattleActionBar();
    updateItemUsability();
  }

  if (pick.ability === 'Change of Heart' && iceShards >= 1) {
    iceShards -= 1;
    const tempHp = playerHp;
    playerHp = enemyHp;
    enemyHp = tempHp;
    updateHpDisplay();
    showAbilitySplash('Change of Heart', `HP swapped! You: ${playerHp} ↔ Enemy: ${enemyHp}`, 1800, () => {
      narrate(`<b class="gold">Change of Heart!</b> HP swapped! You: ${playerHp} · ${enemy.name}: ${enemyHp}`);
      renderBattleActionBar();
      updateItemUsability();
    }, 'playerCard');
  }

  if (pick.ability === 'Bogus' && !bogeyReflectUsed && !bogeyReflectArmed) {
    bogeyReflectArmed = true;
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="gold">Bogus armed!</b> Next hit will be reflected!`);
    renderBattleActionBar();
    updateItemUsability();
  }
}

// ══════════════════════════════════════════════
// RED ACTION BAR (VS MODE ONLY)
// ══════════════════════════════════════════════

function renderRedActionBar() {
  if (!vsMode) return;
  const container = document.getElementById('redActionBar');
  if (!container) return;
  container.innerHTML = '';

  const topRow = document.createElement('div');
  topRow.className = 'action-row';

  const abilityId = enemy ? enemy.ability : null;
  const hasActivatable = ['Teamwork', 'Heating Up', 'Bogus', 'Change of Heart'].includes(abilityId);
  if (hasActivatable) {
    const ab = document.createElement('div');
    ab.className = 'ability-icon';
    ab.id = 'redAbilityBtn';
    let icon = '\u2728';
    if (abilityId === 'Teamwork') icon = '\u{1F91D}';
    if (abilityId === 'Heating Up') icon = '\u{1F525}';
    if (abilityId === 'Bogus') icon = '\u{1F6E1}\uFE0F';
    if (abilityId === 'Change of Heart') icon = '\u{1F504}';
    let label = abilityId.split(' ')[0];
    if (abilityId === 'Bogus' && redBogeyReflectArmed) label = 'ARMED';
    if (abilityId === 'Bogus' && redBogeyReflectUsed) label = 'USED';
    if (abilityId === 'Change of Heart') label = 'Swap';
    ab.innerHTML = `${icon}<div class="icon-label">${label}</div>`;
    ab.title = enemy.abilityDesc;
    if (abilityId === 'Bogus' && redBogeyReflectUsed) ab.classList.add('used');
    ab.onclick = () => activateRedAbility();
    topRow.appendChild(ab);
  }

  if (topRow.children.length > 0) container.appendChild(topRow);

  const totalShards = enemyIceShards + redCommittedShards;
  const totalFires = enemySacredFires + redCommittedFires;
  if (totalShards > 0 || totalFires > 0) {
    const botRow = document.createElement('div');
    botRow.className = 'action-row';

    if (totalShards > 0) {
      const perShard = enemy && enemy.ability === 'Winter Barrage' ? 2 : 1;
      const shard = document.createElement('div');
      shard.className = 'shard-icon' + (redCommittedShards > 0 ? ' committed' : '');
      shard.id = 'redShardBtn';
      const label = redCommittedShards > 0 ? `${redCommittedShards}/${totalShards} \u2694` : `${totalShards}`;
      shard.innerHTML = `<img src="iceshard.png" class="shard-img"><div class="shard-count">${label}</div>`;
      shard.title = redCommittedShards > 0
        ? `${redCommittedShards} committed (+${redCommittedShards*perShard} if Red wins). Tap to cycle.`
        : `${totalShards} Ice Shard${totalShards>1?'s':''}. Tap to commit (+${perShard} each if Red wins).`;
      shard.style.cursor = 'pointer';
      shard.onclick = () => cycleRedShards();
      botRow.appendChild(shard);
    }

    if (totalFires > 0) {
      const fire = document.createElement('div');
      fire.className = 'shard-icon fire' + (redCommittedFires > 0 ? ' committed' : '');
      fire.id = 'redFireBtn';
      const label = redCommittedFires > 0 ? `${redCommittedFires}/${totalFires} \u2694` : `${totalFires}`;
      fire.innerHTML = `<img src="sacredfire.png" class="shard-img"><div class="shard-count">${label}</div>`;
      fire.title = redCommittedFires > 0
        ? `${redCommittedFires} committed (+${redCommittedFires*3} if Red wins). Tap to cycle.`
        : `${totalFires} Sacred Fire${totalFires>1?'s':''}. Tap to commit (+3 each if Red wins).`;
      fire.style.cursor = 'pointer';
      fire.onclick = () => cycleRedFires();
      botRow.appendChild(fire);
    }

    container.appendChild(botRow);
  }
}

function updateRedItemUsability() {
  if (!vsMode) return;
  const abBtn = document.getElementById('redAbilityBtn');
  if (abBtn && enemy) {
    let usable = false;
    const abilityPhaseOk = phase === 1 || phase === 0;
    if (enemy.ability === 'Teamwork' && abilityPhaseOk) usable = true;
    if (enemy.ability === 'Heating Up' && abilityPhaseOk && enemyHp > 3) usable = true;
    if (enemy.ability === 'Change of Heart' && abilityPhaseOk && enemyIceShards >= 1) usable = true;
    if (enemy.ability === 'Bogus' && abilityPhaseOk && !redBogeyReflectUsed && !redBogeyReflectArmed) usable = true;
    abBtn.classList.toggle('usable', usable);
  }

  const hasShardIcon = document.querySelector('#redActionBar .shard-icon:not(.fire)');
  const hasFireIcon = document.querySelector('#redActionBar .shard-icon.fire');
  if ((enemyIceShards > 0 || redCommittedShards > 0) !== !!hasShardIcon || (enemySacredFires > 0 || redCommittedFires > 0) !== !!hasFireIcon) {
    renderRedActionBar();
  } else {
    if (hasShardIcon && (enemyIceShards > 0 || redCommittedShards > 0)) {
      const ts = enemyIceShards + redCommittedShards;
      hasShardIcon.querySelector('.shard-count').textContent = redCommittedShards > 0 ? `${redCommittedShards}/${ts} \u2694` : `${ts}`;
    }
    if (hasFireIcon && (enemySacredFires > 0 || redCommittedFires > 0)) {
      const tf = enemySacredFires + redCommittedFires;
      hasFireIcon.querySelector('.shard-count').textContent = redCommittedFires > 0 ? `${redCommittedFires}/${tf} \u2694` : `${tf}`;
    }
  }
}

function cycleRedShards() {
  if (phase !== 1 && phase !== 0) return;
  const total = enemyIceShards + redCommittedShards;
  if (total <= 0) return;
  redCommittedShards++;
  enemyIceShards--;
  if (redCommittedShards > total) {
    enemyIceShards = total;
    redCommittedShards = 0;
  }
  playSfx('sfxSpecial', 0.4);
  const perShard = enemy && enemy.ability === 'Winter Barrage' ? 2 : 1;
  if (redCommittedShards > 0) {
    narrate(`<b class="them">${redCommittedShards} Ice Shard${redCommittedShards>1?'s':''} committed (Red)!</b> +${redCommittedShards*perShard} if Red wins.`);
  } else {
    narrate(`Red Ice Shards uncommitted.`);
  }
  renderRedActionBar();
}

function cycleRedFires() {
  if (phase !== 1 && phase !== 0) return;
  const total = enemySacredFires + redCommittedFires;
  if (total <= 0) return;
  redCommittedFires++;
  enemySacredFires--;
  if (redCommittedFires > total) {
    enemySacredFires = total;
    redCommittedFires = 0;
  }
  playSfx('sfxSpecial', 0.4);
  if (redCommittedFires > 0) {
    narrate(`<b class="them">${redCommittedFires} Sacred Fire${redCommittedFires>1?'s':''} committed (Red)!</b> +${redCommittedFires*3} if Red wins.`);
  } else {
    narrate(`Red Sacred Fires uncommitted.`);
  }
  renderRedActionBar();
}

function activateRedAbility() {
  if (!enemy || !vsMode) return;
  if (phase !== 1 && phase !== 0) return;

  if (enemy.ability === 'Teamwork') {
    enemyRemoveDice += 1;
    enemyHp += 1;
    updateHpDisplay();
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="them">Teamwork (Red)!</b> -1 die \u2192 +1 HP! (${enemyHp}/${enemy.maxHp})`);
    renderRedActionBar();
    updateRedItemUsability();
  }

  if (enemy.ability === 'Heating Up' && enemyHp > 3) {
    enemyHp -= 2;
    enemyBonusDice += 1;
    updateHpDisplay();
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="them">Heating Up (Red)!</b> -2 HP \u2192 +1 die this roll!`);
    renderRedActionBar();
    updateRedItemUsability();
  }

  if (enemy.ability === 'Change of Heart' && enemyIceShards >= 1) {
    enemyIceShards -= 1;
    const tempHp = enemyHp;
    enemyHp = playerHp;
    playerHp = tempHp;
    updateHpDisplay();
    showAbilitySplash('Change of Heart', `HP swapped! Red: ${enemyHp} \u2194 Blue: ${playerHp}`, 1800, () => {
      narrate(`<b class="them">Change of Heart (Red)!</b> HP swapped! Red: ${enemyHp} \u00b7 Blue: ${playerHp}`);
      renderRedActionBar();
      updateRedItemUsability();
    }, 'enemyCard');
  }

  if (enemy.ability === 'Bogus' && !redBogeyReflectUsed && !redBogeyReflectArmed) {
    redBogeyReflectArmed = true;
    playSfx('sfxSpecial', 0.7);
    narrate(`<b class="them">Bogus armed (Red)!</b> Next hit will be reflected!`);
    renderRedActionBar();
    updateRedItemUsability();
  }
}

// ══════════════════════════════════════════════
// ITEM ACTIVATION
// ══════════════════════════════════════════════
function activateItem(idx) {
  const bi = battleItemsState[idx];
  if (!bi || bi.used) return;

  if (bi.id === 'heal') {
    if (phase < 1) return;
    bi.used = true;
    playerHp += 4;
    updateHpDisplay();
    playSfx('sfxSpecial', 0.7);
    const overclocked = playerHp > pick.maxHp ? ' <b style="color:#34d399;">OVERCLOCKED!</b>' : '';
    narrate(`<b class="gold">+4 HP!</b> Now at ${playerHp}/${pick.maxHp}.${overclocked}`);
    if (state && state.stats) state.stats.itemsUsed++;
    renderBattleActionBar();
    updateItemUsability();
  }

  if (bi.id === 'power') {
    if (phase !== 1) return;
    bi.used = true;
    powerMode++;
    // Show bonus dice slots
    for (let d = 3; d < 3 + powerMode; d++) {
      const el = document.getElementById('pDie' + d);
      if (el) el.style.display = 'flex';
    }
    if (state && state.stats) state.stats.itemsUsed++;
    const total = 3 + powerMode;
    narrate(`<b class="gold">+${powerMode} Di${powerMode > 1 ? 'ce' : 'e'}!</b> Rolling ${total} dice!`);
    renderBattleActionBar();
    updateItemUsability();
  }

  if (bi.id === 'reroll') {
    if (phase !== 3) return;
    clearRerollCountdown();
    bi.used = true;
    rerollMode = true;
    if (state && state.stats) state.stats.itemsUsed++;
    narrate(`<b class="gold">Tap a die to reroll!</b>`);
    // Make player dice clickable
    const count = 3 + powerMode;
    for (let i = 0; i < count; i++) {
      const d = document.getElementById('pDie' + i);
      d.classList.add('rerollable');
      d.onclick = () => doReroll(i);
    }
    renderBattleActionBar();
  }
}

// ══════════════════════════════════════════════
// REROLL SYSTEM
// ══════════════════════════════════════════════
let rerollCountdownTimer = null;

function startRerollCountdown(seconds, extraDelay, callback) {
  clearRerollCountdown();
  // Find the reroll item element
  const rerollEl = findRerollItemEl();
  if (!rerollEl) { setTimeout(callback, (seconds * 800) + extraDelay); return; }

  let remaining = seconds;
  showCountdownNum(rerollEl, remaining);

  rerollCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearRerollCountdown();
      callback();
    } else {
      showCountdownNum(rerollEl, remaining);
    }
  }, 800);
}

function showCountdownNum(parentEl, num) {
  let cd = parentEl.querySelector('.reroll-countdown');
  if (!cd) {
    cd = document.createElement('div');
    cd.className = 'reroll-countdown';
    parentEl.appendChild(cd);
  }
  cd.textContent = num;
  cd.style.animation = 'none';
  requestAnimationFrame(() => { cd.style.animation = ''; });
}

function clearRerollCountdown() {
  if (rerollCountdownTimer) { clearInterval(rerollCountdownTimer); rerollCountdownTimer = null; }
  document.querySelectorAll('.reroll-countdown').forEach(el => el.remove());
}

function findRerollItemEl() {
  const items = document.querySelectorAll('#battleActionBar .battle-item');
  let stateIdx = 0;
  for (let i = 0; i < items.length; i++) {
    while (stateIdx < battleItemsState.length && !battleItemsState[stateIdx].id) stateIdx++;
    if (stateIdx < battleItemsState.length && battleItemsState[stateIdx].id === 'reroll' && !battleItemsState[stateIdx].used) return items[i];
    stateIdx++;
  }
  return null;
}

function doReroll(dieIndex) {
  if (!rerollMode) return;
  rerollMode = false;
  clearRerollCountdown();
  // Remove clickable from all dice
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('pDie' + i);
    d.classList.remove('rerollable');
    d.onclick = null;
  }

  const d = document.getElementById('pDie' + dieIndex);
  d.classList.add('rolling');
  d.classList.remove('glow', 'triples-glow');
  playSfx('sfxDiceRoll');

  setTimeout(() => {
    // 60% chance to match one of the other dice (creates hype doubles/triples)
    let newVal;
    const otherDice = playerDiceValues.filter((_, i) => i !== dieIndex);
    if (otherDice.length > 0 && Math.random() < 0.60) {
      newVal = otherDice[Math.floor(Math.random() * otherDice.length)];
    } else {
      newVal = Math.floor(Math.random() * 6) + 1;
    }
    playerDiceValues[dieIndex] = newVal;
    d.classList.remove('rolling');
    d.textContent = newVal;

    // Re-analyze using best 3 if more than 3 dice
    let finalDice;
    if (playerDiceValues.length > 3) {
      finalDice = bestNOf(playerDiceValues, 3);
    } else {
      finalDice = [...playerDiceValues];
    }

    const pRoll = analyzeRoll(finalDice);
    // Update glow
    for (let i = 0; i < playerDiceValues.length; i++) {
      const die = document.getElementById('pDie' + i);
      die.classList.remove('glow', 'triples-glow', 'discarded');
    }
    if (powerMode) highlightBestThree(playerDiceValues, pRoll);
    else {
      finalDice.forEach((v, i) => {
        if (pRoll.matchDie && v === pRoll.matchDie) document.getElementById('pDie'+i).classList.add('glow');
      });
    }

    narrate(`Rerolled! Now: ${describeRoll(pRoll)}`);
    setTimeout(() => resolveRound(pRoll, currentEnemyRoll), 800);
  }, 500);
}

// ══════════════════════════════════════════════
// TRIPLES + VISUAL FX
// ══════════════════════════════════════════════
function showTriplesEffect(side, rollType) {
  const banner = document.getElementById('triplesBanner');
  const flash = document.getElementById('triplesFlash');
  // Set banner text based on hand type
  const bannerText = { sixcity: 'SIX CITY!!!', penta: 'PENTA!!', quads: 'QUADS!', triples: 'TRIPLES!' };
  banner.textContent = bannerText[rollType] || 'TRIPLES!';
  for (let i = 0; i < 7; i++) {
    const d = document.getElementById((side === 'enemy' ? 'eDie' : 'pDie') + i);
    if (d && d.style.display !== 'none') {
      d.classList.remove('glow');
      d.classList.add('triples-glow');
    }
  }
  playSfx('triplesSfx', 1.0);
  flash.className = 'triples-flash ' + (side === 'enemy' ? 'enemy-flash' : 'player-flash');
  flash.style.transition = 'none';
  flash.style.opacity = '0.6';
  requestAnimationFrame(() => { flash.style.transition = 'opacity 0.8s ease-out'; flash.style.opacity = '0'; });
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);
  banner.className = 'triples-banner ' + (side === 'enemy' ? 'enemy-triples' : 'player-triples');
  requestAnimationFrame(() => {
    banner.classList.add('show');
    setTimeout(() => { banner.classList.remove('show'); banner.classList.add('fade'); setTimeout(() => { banner.className = 'triples-banner'; }, 500); }, 1200);
  });
}

function showAbilityCard(cardId) {
  removeAbilityCard();
  const card = document.getElementById(cardId);
  const rect = card.getBoundingClientRect();
  const clone = document.createElement('div');
  clone.className = 'ability-card-overlay';
  clone.innerHTML = card.innerHTML;
  clone.style.left = rect.left + 'px';
  clone.style.top = rect.top + 'px';
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';
  // In VS mode, enemy card's parent zone is rotated 180deg — clone must inherit that
  const inEnemyZone = vsMode && card.closest('.enemy-zone');
  clone.style.transform = inEnemyZone ? 'scale(1) rotate(180deg)' : 'scale(1)';
  document.body.appendChild(clone);
  abilityOverlayEl = clone;
  requestAnimationFrame(() => { clone.style.transform = inEnemyZone ? 'scale(1.10) rotate(180deg)' : 'scale(1.10)'; });
}

function removeAbilityCard() {
  if (abilityOverlayEl) { abilityOverlayEl.remove(); abilityOverlayEl = null; }
}

function showAbilitySplash(name, desc, duration, callback, cardId) {
  const el = document.getElementById('abilitySplash');
  const theme = ABILITY_THEMES[name] || '';
  el.className = 'ability-splash ' + theme;
  document.getElementById('splashName').textContent = name;
  document.getElementById('splashDesc').textContent = desc;
  document.getElementById('counterDieArea').classList.remove('visible');
  if (cardId) showAbilityCard(cardId);
  playSfx('sfxSpecial', 0.85);
  el.classList.add('active');
  setTimeout(() => { el.classList.remove('active'); removeAbilityCard(); setTimeout(callback, 300); }, duration);
}

// ══════════════════════════════════════════════
// PREDICTION
// ══════════════════════════════════════════════
function pickPrediction(num) {
  playerPrediction = num;
  document.getElementById('predictArea').classList.remove('visible');
  if (vsMode) {
    // In VS mode, show blue's roll button after prediction
    document.getElementById('vsBlueRollArea').classList.add('active');
    // Check if we're still waiting for red's prediction too
    const redNeedsPrediction = enemy.ability === 'Valley Guardian' && enemyPrediction === null;
    if (redNeedsPrediction) {
      narrate('Blue picked! Waiting for Red to predict...');
    } else {
      narrate(`Round ${round} — Both players, roll!`);
      // If red already predicted or doesn't need to, show red roll
      if (!document.getElementById('vsRedRollArea').classList.contains('active') && enemy.ability !== 'Stone Form') {
        document.getElementById('vsRedRollArea').classList.add('active');
      }
    }
  } else {
    if (phase !== 1) return;
    document.getElementById('rollBtn').classList.add('ready');
    updateItemUsability();
  }
}

function pickRedPrediction(num) {
  enemyPrediction = num;
  document.getElementById('redPredictArea').classList.remove('visible');
  // Show red's roll button
  document.getElementById('vsRedRollArea').classList.add('active');
  // Check if blue still needs to predict
  const blueNeedsPrediction = pick.ability === 'Valley Guardian' && playerPrediction === null;
  if (blueNeedsPrediction) {
    narrate('Red picked! Waiting for Blue to predict...');
  } else {
    narrate(`Round ${round} — Both players, roll!`);
    // If blue already predicted or doesn't need to, show blue roll
    if (!document.getElementById('vsBlueRollArea').classList.contains('active') && pick.ability !== 'Stone Form') {
      document.getElementById('vsBlueRollArea').classList.add('active');
    }
  }
}

// ══════════════════════════════════════════════
// SLASH EFFECT
// ══════════════════════════════════════════════
function showSlashEffect(callback) {
  const overlay = document.getElementById('slashOverlay');
  const eCard = document.getElementById('enemyCard');

  // Position slash lines over the enemy card
  if (eCard) {
    const r = eCard.getBoundingClientRect();
    const pad = 30;
    overlay.style.top = (r.top - pad) + 'px';
    overlay.style.left = (r.left - pad) + 'px';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
    overlay.style.width = (r.width + pad * 2) + 'px';
    overlay.style.height = (r.height + pad * 2) + 'px';
  }

  overlay.classList.add('active');
  playSfx('sfxSpecial', 1.0);

  // Shake only the enemy card, not the whole screen
  if (eCard) {
    eCard.style.animation = 'shake 0.5s ease-out';
    setTimeout(() => { eCard.style.animation = ''; }, 500);
  }

  setTimeout(() => {
    overlay.classList.remove('active');
    // Reset to fullscreen defaults
    overlay.style.top = ''; overlay.style.left = '';
    overlay.style.right = ''; overlay.style.bottom = '';
    overlay.style.width = ''; overlay.style.height = '';
    if (callback) callback();
  }, 600);
}

// ══════════════════════════════════════════════
// CRASH / PARTICLES
// ══════════════════════════════════════════════
function crashAnimation() {
  const overlay = document.getElementById('crashOverlay');
  const pc = document.getElementById('crashPlayer');
  const ec = document.getElementById('crashEnemy');
  const flash = document.getElementById('impactFlash');
  const vicText = document.getElementById('victoryText');

  const mob = window.innerWidth <= 480;
  const W = mob ? 200 : 240, H = mob ? 280 : 336;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;

  pc.innerHTML = `<img src="${IMG}${pick.file}">`;
  ec.innerHTML = `<img src="${IMG}${enemy.file}">`;

  ec.style.cssText = `height:${H}px;width:auto;left:50%;top:${cy-H/2-20}px;transform:translateX(-50%);transition:none;opacity:1;border-radius:14px;`;
  pc.style.cssText = `height:${H}px;width:auto;left:50%;top:${innerHeight+20}px;transform:translateX(-50%);transition:none;opacity:1;border-radius:14px;`;
  pc.classList.remove('winner');
  vicText.classList.remove('show');
  overlay.classList.add('active');

  requestAnimationFrame(() => {
    pc.style.transition = 'top 0.35s cubic-bezier(0.2,0,0.4,1)';
    pc.style.top = `${cy-H/2-20}px`;
  });

  setTimeout(() => {
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
    flash.style.transition = 'none';
    flash.style.opacity = '0.8';
    requestAnimationFrame(() => { flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0'; });
    ec.style.opacity = '0';
    spawnShards(cx-W/2, cy-H/2-20, W, H);
    pc.style.transition = 'top 0.6s cubic-bezier(0.34,1.56,0.64,1)';
    pc.style.top = `${cy-H/2}px`;
    pc.classList.add('winner');

    setTimeout(() => { vicText.classList.add('show'); spawnSparkles(cx, cy, W, H); }, 500);

    setTimeout(() => {
      vicText.classList.remove('show');
      pc.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
      pc.style.opacity = '0';
      pc.style.transform = 'translateX(-50%) scale(1.3)';
      setTimeout(() => {
        overlay.classList.remove('active');
        document.querySelectorAll('.shard').forEach(s => s.remove());
        document.querySelectorAll('.sparkle').forEach(s => s.remove());
        pc.style.transform = 'translateX(-50%)';
        afterBattleWin();
      }, 900);
    }, 2800);
  }, 380);
}

function spawnSparkles(cx, cy, W, H) {
  const overlay = document.getElementById('crashOverlay');
  function burst(count, delay, spread, distMin, distMax, sizeMin, sizeMax) {
    setTimeout(() => {
      for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'sparkle';
        const angle = Math.random() * Math.PI * 2;
        const dist = distMin + Math.random() * distMax;
        s.style.left = (cx + (Math.random() - 0.5) * W * spread) + 'px';
        s.style.top = (cy + (Math.random() - 0.5) * H * spread) + 'px';
        const size = sizeMin + Math.random() * sizeMax;
        s.style.width = size + 'px'; s.style.height = size + 'px';
        s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
        s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
        const r = Math.random();
        s.style.background = r > 0.6 ? 'var(--gold)' : r > 0.3 ? 'var(--player)' : '#fff';
        s.style.animation = `sparkleFloat ${0.7 + Math.random() * 0.8}s ease-out ${Math.random() * 0.3}s forwards`;
        overlay.appendChild(s);
      }
    }, delay);
  }
  burst(80, 0, 1.2, 50, 160, 3, 7);
  burst(70, 300, 0.8, 60, 180, 2, 6);
  burst(65, 600, 1.0, 40, 200, 3, 8);
  burst(60, 900, 1.3, 70, 220, 2, 5);
  burst(55, 1200, 0.9, 50, 180, 3, 7);
}

function spawnShards(x, y, W, H) {
  const cols = 4, rows = 5, sw = W/cols, sh = H/rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = document.createElement('div');
      s.className = 'shard';
      s.style.width = sw+'px'; s.style.height = sh+'px';
      s.style.left = (x+c*sw)+'px'; s.style.top = (y+r*sh)+'px';
      s.style.borderRadius = '2px';
      const img = document.createElement('img');
      img.src = IMG + enemy.file;
      img.style.width = W+'px'; img.style.height = H+'px';
      img.style.left = -(c*sw)+'px'; img.style.top = -(r*sh)+'px';
      s.appendChild(img);
      document.getElementById('crashOverlay').appendChild(s);
      const angle = Math.atan2(r-rows/2+.5, c-cols/2+.5);
      const dist = 200+Math.random()*300;
      const dx = Math.cos(angle)*dist+(Math.random()-.5)*100;
      const dy = Math.sin(angle)*dist+Math.random()*200;
      const rot = (Math.random()-.5)*720;
      const delay = Math.random()*80;
      s.style.transition = 'none';
      requestAnimationFrame(() => {
        s.style.transition = `transform ${1+Math.random()*.6}s cubic-bezier(0.2,0,0.3,1) ${delay}ms, opacity ${1.2+Math.random()*.5}s ease-out ${delay+200}ms`;
        s.style.transform = `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${.2+Math.random()*.3})`;
        s.style.opacity = '0';
      });
    }
  }
}

// ══════════════════════════════════════════════
// PARTICLES + EFFECTS
// ══════════════════════════════════════════════
function spawnSpiritParticles() {
  const container = document.getElementById('spiritParticles');
  container.innerHTML = '';
  if (spiritInterval) clearInterval(spiritInterval);
  spiritInterval = setInterval(() => {
    const dot = document.createElement('div');
    dot.className = 'spirit-dot';
    const size = 2 + Math.random() * 3;
    dot.style.width = size + 'px'; dot.style.height = size + 'px';
    dot.style.left = (Math.random() * 100) + '%';
    dot.style.top = (30 + Math.random() * 60) + '%';
    const colors = ['rgba(103,232,249,0.7)', 'rgba(192,132,252,0.6)', 'rgba(251,191,36,0.5)', 'rgba(255,255,255,0.5)'];
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.boxShadow = `0 0 ${4+Math.random()*6}px ${dot.style.background}`;
    const dur = 4 + Math.random() * 6;
    dot.style.animationDuration = dur + 's';
    container.appendChild(dot);
    setTimeout(() => dot.remove(), dur * 1000);
  }, 500);
}

function stopSpiritParticles() { if (spiritInterval) { clearInterval(spiritInterval); spiritInterval = null; } }

function startSnow() {
  const container = document.getElementById('snowContainer');
  container.classList.add('active');
  snowInterval = setInterval(() => {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    const size = 1.5 + Math.random() * 2.5;
    const w = window.innerWidth, h = window.innerHeight;
    let startX, startY;
    if (Math.random() < 0.7) { startX = Math.random() * w; startY = -10; }
    else { startX = w + 5; startY = Math.random() * h * 0.5; }
    const driftX = -(30 + Math.random() * 80);
    const driftY = h * 0.6 + Math.random() * h * 0.5;
    const duration = 8 + Math.random() * 7;
    flake.style.width = size + 'px'; flake.style.height = size + 'px';
    flake.style.left = startX + 'px'; flake.style.top = startY + 'px';
    flake.style.setProperty('--sx', driftX + 'px');
    flake.style.setProperty('--sy', driftY + 'px');
    flake.style.animationDuration = duration + 's';
    container.appendChild(flake);
    setTimeout(() => flake.remove(), duration * 1000);
  }, 350);
}

function stopSnow() {
  if (snowInterval) { clearInterval(snowInterval); snowInterval = null; }
  const container = document.getElementById('snowContainer');
  setTimeout(() => { container.classList.remove('active'); container.innerHTML = ''; }, 4000);
}

// ══════════════════════════════════════════════
// MUSIC
// ══════════════════════════════════════════════
let fadeIntervalId = null;
function fadeOutMusic() {
  const music = document.getElementById('bgMusic');
  if (fadeIntervalId) clearInterval(fadeIntervalId);
  let vol = music.volume;
  fadeIntervalId = setInterval(() => {
    vol -= 0.03;
    if (vol <= 0) { clearInterval(fadeIntervalId); fadeIntervalId = null; music.pause(); music.volume = 0.4; }
    else music.volume = vol;
  }, 60);
}

function stopMusicHard() {
  if (fadeIntervalId) { clearInterval(fadeIntervalId); fadeIntervalId = null; }
  const music = document.getElementById('bgMusic');
  music.pause(); music.currentTime = 0; music.volume = 0.4;
}
