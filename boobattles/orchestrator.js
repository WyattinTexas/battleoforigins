// ══════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — Game flow, run management, VS mode, screen transitions
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// RUN MANAGEMENT
// ══════════════════════════════════════════════

function beginRun() {
  coopMode = false; vsMode = false;
  state = newState(false);
  iceShards = 0; sacredFires = 0; // reset for new run
  saveState();
  showInitialPick();
}

function continueRun() {
  state = loadState();
  if (!state) return beginRun();
  showMap();
}

function retryRun() {
  stopSnow();
  // Check if player has beaten the game before (HoF has Mountain King entry)
  const hof = getHallOfFame();
  const hasBeatenGame = hof.some(e => e.boss === 'The Mountain King');
  BOSSES = buildBosses(hasBeatenGame);
  // Update locations for replay
  if (hasBeatenGame) {
    for (let i = 0; i < 8; i++) BOSS_LOCATIONS[i] = ['???'][0]; // mystery for random bosses
    BOSS_LOCATIONS[8] = REPLAY_FINAL4_LOCATIONS[0];
    BOSS_LOCATIONS[9] = REPLAY_FINAL4_LOCATIONS[1];
    BOSS_LOCATIONS[10] = REPLAY_FINAL4_LOCATIONS[2];
    BOSS_LOCATIONS[11] = REPLAY_FINAL4_LOCATIONS[3];
  }
  state = newState(true);
  iceShards = 0; sacredFires = 0;
  saveState();
  showInitialPick();
}

// ══════════════════════════════════════════════
// BATTLE START
// ══════════════════════════════════════════════

function startBattle() {
  pick = { ...state.collection[selectedGhostIndex] };
  enemy = { ...BOSSES[state.currentBoss] };
  playerHp = pick.hp;
  enemyHp = enemy.bossHp;
  round = 1;
  phase = 0;
  playerPrediction = null;
  rerollMode = false;
  powerMode = 0;
  playerDiceValues = [];

  // Reset ability state
  // Player ice shards & sacred fires persist between fights
  enemyIceShards = 0;
  enemySacredFires = 0;
  committedShards = 0;
  committedFires = 0;
  playerBonusDice = 0; enemyBonusDice = 0;
  playerRemoveDice = 0; enemyRemoveDice = 0;
  bogeyReflectUsed = false;
  bogeyReflectArmed = false;
  isFirstRoll = true;
  enemyHeinousUsed = false;
  tookDamageLastRound = false;

  // Scripted boss fights — boss 0-2 always scripted (tutorial + early wins)
  // Boss 3+ (Stone Cold onward): 50% scripted, 50% random with enemy ability modifiers
  bossScriptRound = 0;
  if (state.currentBoss === 0) {
    bossScript = BOSS0_SCRIPTS[pick.name] || null;
  } else {
    const scripts = [null, BOSS1_SCRIPT, BOSS2_SCRIPT, BOSS3_SCRIPT, BOSS4_SCRIPT, BOSS5_SCRIPT, BOSS6_SCRIPT, BOSS7_SCRIPT, BOSS8_SCRIPT, BOSS9_SCRIPT, BOSS10_SCRIPT, BOSS11_SCRIPT];
    // Boss 2 (Guard Thomas): always starts scripted, but can break out per-round (see doEnemyRoll)
    // Boss 3+ (Stone Cold onward): 50/50
    const useScript = state.currentBoss <= 2 || Math.random() < 0.5;
    bossScript = useScript ? (varyScript(scripts[state.currentBoss]) || null) : null;
  }

  // Chad: ice shards added after entry splash (not here)
  if (enemy.ability === 'Sploop!') enemyIceShards += 2;

  // Wandering Sue: if enemy >12 HP, instant destroy
  if (pick.ability === 'Hidden Weakness' && enemyHp >= 12) {
    // Will handle after battle screen shows — set flag
    setTimeout(() => {
      narrate(`<b class="gold">Hidden Weakness!</b> ${enemy.name} destroyed!`);
      enemyHp = 0;
      updateHpDisplay();
      setTimeout(enemyDefeated, 1200);
    }, 2500);
  }

  // Set up battle items from inventory
  battleItemsState = state.items.map(id => ({ id, used: false }));

  showScreen('battleScreen');
  document.getElementById('enemyCard').innerHTML = `<img src="${IMG}${enemy.file}">`;
  document.getElementById('playerCard').innerHTML = `<img src="${IMG}${pick.file}">`;
  document.getElementById('enemyNameText').textContent = enemy.name;
  document.getElementById('playerNameText').textContent = pick.name;
  updateHpDisplay();
  document.getElementById('enemyCard').classList.remove('hit');
  document.getElementById('enemyCard').style.opacity = '1';
  document.getElementById('enemyCard').style.transition = 'none';
  document.getElementById('enemyPlate').style.opacity = '1';
  document.getElementById('enemyPlate').style.transition = 'none';
  document.getElementById('playerCard').classList.remove('hit');
  document.getElementById('predictArea').classList.remove('visible');
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';

  resetDice();
  narrate('');
  document.getElementById('rollBtn').classList.remove('ready');
  document.getElementById('diceArea').classList.add('hidden');
  renderBattleActionBar();

  spawnSpiritParticles();
  const music = document.getElementById('bgMusic');
  music.currentTime = 0;
  music.volume = 0.4;
  music.play().catch(() => {});

  // Ready-go overlay
  const rgo = document.getElementById('readyGoOverlay');
  const rgt = document.getElementById('readyGoText');
  rgt.textContent = 'Start';
  rgt.style.animation = 'none';
  rgo.classList.add('active');
  requestAnimationFrame(() => { rgt.style.animation = ''; });
  setTimeout(() => {
    rgo.classList.remove('active');
    document.getElementById('diceArea').classList.remove('hidden');

    // On-entry ability splashes
    if (pick.ability === 'Sploop!') {
      showAbilitySplash('Sploop!', '+2 Ice Shards!', 1600, () => {
        iceShards += 2;
        renderBattleActionBar();
        narrate(`<b class="them">${enemy.name}</b>&nbsp;rolls first...`);
        setTimeout(doEnemyRoll, 1000);
      }, 'playerCard');
    } else {
      narrate(`<b class="them">${enemy.name}</b>&nbsp;rolls first...`);
      setTimeout(doEnemyRoll, 1000);
    }
  }, 1800);
}

// ══════════════════════════════════════════════
// POST-BATTLE
// ══════════════════════════════════════════════

function enemyDefeated() {
  lastKillWasSlash = false;
  if (coopMode) {
    coopSyncFromBattle();
    narrate(`<b class="gold">${enemy.name}&nbsp;is defeated!</b>`);
    updateCoopPanels();
    coopAfterRound();
    return;
  }
  narrate(`<b class="gold">${enemy.name}&nbsp;is defeated!</b>`);
  const eCard = document.getElementById('enemyCard');
  const ePlate = document.getElementById('enemyPlate');
  eCard.style.transition = 'opacity 0.8s ease-out';
  eCard.style.opacity = '0';
  ePlate.style.transition = 'opacity 0.8s ease-out';
  ePlate.style.opacity = '0';
  setTimeout(crashAnimation, 1400);
}

function handlePlayerLoss() {
  if (coopMode) {
    coopSyncFromBattle();
    updateCoopPanels();
    coopAfterRound();
    return;
  }
  if (vsMode) { vsHandleLoss(); return; }
  // Permadeath: remove ghost from collection
  const deadGhost = { ...pick };
  state.collection.splice(selectedGhostIndex, 1);
  state.deadGhosts.push(pick.name);
  state.killedBy[pick.name] = enemy.name;
  state.stats.ghostsLost++;

  // Powder's Final Gift: grant 3 Ice Shards on death
  if (deadGhost.ability === 'Final Gift') {
    iceShards += 3;
  }

  // Sync remaining items
  state.items = battleItemsState.filter(bi => !bi.used).map(bi => bi.id);
  saveState();

  stopSpiritParticles();

  // Show farewell overlay — ghost fades to nothing
  stopMusicHard();
  const overlay = document.getElementById('farewellOverlay');
  document.getElementById('farewellCard').innerHTML = `<img src="${IMG}${deadGhost.file}">`;
  document.getElementById('farewellName').textContent = deadGhost.name;
  const farewellMsg = deadGhost.ability === 'Final Gift' ? 'Final Gift... +3 Ice Shards' : 'Farewell...';
  document.getElementById('farewellText').textContent = farewellMsg;
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');
    // Go directly to next screen — no flash back to battle
    if (state.collection.length === 0) {
      showGameOver();
    } else {
      showMap();
    }
  }, 5000);
}

function afterBattleWin() {
  if (coopMode) {
    coopSyncFromBattle();
    updateCoopPanels();
    coopAfterRound();
    return;
  }
  if (vsMode) { vsHandleWin(); return; }
  fadeOutMusic();
  stopSpiritParticles();

  // Heal all ghosts to full HP between fights
  state.collection.forEach(g => { g.hp = g.maxHp; });

  // Sync remaining items (cap at 3)
  state.items = battleItemsState.filter(bi => !bi.used).map(bi => bi.id).slice(0, 3);

  state.stats.bossesBeaten++;

  // Track which ghost beat which boss
  if (!state.battleWins) state.battleWins = [];
  const boss = BOSSES[state.currentBoss];
  state.battleWins.push({ ghost: pick.name, ghostFile: pick.file, boss: boss.name });

  state.currentBoss++;
  saveState();

  if (state.currentBoss >= 12) {
    // Victory!
    showVictory();
  } else {
    showRewards();
  }
}

// ══════════════════════════════════════════════
// REWARDS SCREEN
// ══════════════════════════════════════════════

function showRewards() {
  showScreen('rewardScreen');

  // Reset all staggered animations
  document.querySelectorAll('.rw-anim').forEach(el => el.classList.remove('rw-show'));
  document.getElementById('rewardSelectedInfo').classList.remove('visible');
  document.getElementById('rewardContinueBtn').classList.remove('ready');

  // Item drop
  const boss = BOSSES[state.currentBoss - 1];
  pendingRewardItem = boss.drop;
  if (pendingRewardItem) {
    const item = ITEMS[pendingRewardItem];
    document.getElementById('rewardItemIcon').textContent = item.icon;
    document.getElementById('rewardItemName').textContent = item.name;
    document.getElementById('rewardItemDesc').textContent = item.desc;
    document.getElementById('rewardItemBox').style.display = 'flex';

    if (state.items.length >= 3) {
      document.getElementById('rewardOverflow').textContent = 'Inventory full! Oldest item will be replaced.';
      document.getElementById('rewardOverflow').style.display = 'block';
    } else {
      document.getElementById('rewardOverflow').style.display = 'none';
    }
  } else {
    document.getElementById('rewardItemBox').style.display = 'none';
    document.getElementById('rewardOverflow').style.display = 'none';
  }

  // Draw 2 new ghost cards — player picks 1
  const weights = DRAW_WEIGHTS[state.currentBoss - 1];
  pendingRewardCards = [];
  selectedRewardCard = -1;
  for (let i = 0; i < 2; i++) {
    const card = drawGhost(weights);
    if (card) pendingRewardCards.push(card);
  }

  const container = document.getElementById('rewardCards');
  container.innerHTML = '';
  rewardRevealedCards = new Set();

  const rarityBadgeClass = r => r === 'ghost-rare' ? 'ghost-rare' : r === 'legendary' ? 'legendary' : r;
  const rarityLabel = r => (r === 'ghost-rare' || r === 'legendary') ? 'LEGEND' : r.toUpperCase();

  pendingRewardCards.forEach((g, i) => {
    const c = document.createElement('div');
    c.className = 'reward-card rc-facedown';
    c.innerHTML = `
      <div class="rc-back"><img src="${CARDBACK}" alt=""><div class="rc-back-text">Tap to Reveal</div></div>
      <div class="rc-rarity rarity-badge ${rarityBadgeClass(g.rarity)}">${rarityLabel(g.rarity)}</div>
      <img src="${IMG}${g.file}">
      <div class="rc-name">${g.name}</div>
      <div class="rc-ability">${g.ability} · ${g.maxHp} HP</div>
    `;
    c.onclick = () => rewardRevealAndSelect(i);
    container.appendChild(c);
  });

  // Staggered entrance: title → item → ghost label → cards
  const stagger = [
    { el: 'rewardTitle', delay: 200 },
    { el: 'rewardItemBox', delay: 700 },
    { el: 'rewardGhostLabel', delay: 1200 },
    { el: null, delay: 1400, action: () => document.querySelector('.reward-cards')?.classList.add('rw-show') },
  ];
  stagger.forEach(({ el, delay, action }) => {
    setTimeout(() => {
      if (el) document.getElementById(el)?.classList.add('rw-show');
      if (action) action();
    }, delay);
  });

  // If only 1 card drawn, auto-reveal and select it after cards appear
  if (pendingRewardCards.length === 1) {
    setTimeout(() => rewardRevealAndSelect(0), 1800);
  }
}

let selectedRewardCard = -1;
let rewardRevealedCards = new Set();

function rewardRevealAndSelect(idx) {
  const cards = document.querySelectorAll('#rewardCards .reward-card');
  const card = cards[idx];

  if (!rewardRevealedCards.has(idx)) {
    rewardRevealedCards.add(idx);
    card.classList.remove('rc-facedown');
    card.classList.add('rc-revealed');
    playSfx('sfxSpecial', 0.6);
    setTimeout(() => selectRewardCard(idx), 300);
    return;
  }
  selectRewardCard(idx);
}

function selectRewardCard(idx) {
  selectedRewardCard = idx;
  const cards = document.querySelectorAll('#rewardCards .reward-card');
  const rarityColors = {
    common: '#9ca3af', uncommon: '#4ade80', rare: '#60a5fa',
    'ghost-rare': '#fbbf24', legendary: '#c084fc'
  };

  cards.forEach((c, i) => {
    if (rewardRevealedCards.has(i)) {
      c.classList.remove('rc-facedown');
      c.classList.toggle('rc-selected', i === idx);
      c.classList.toggle('rc-dimmed', i !== idx && rewardRevealedCards.has(i));
    }
  });

  const g = pendingRewardCards[idx];
  const rarityGlows = {
    common: 'rgba(156,163,175,0.3)', uncommon: 'rgba(74,222,128,0.3)',
    rare: 'rgba(96,165,250,0.4)', 'ghost-rare': 'rgba(251,191,36,0.4)', legendary: 'rgba(192,132,252,0.4)'
  };
  const nameEl = document.getElementById('rsiName');
  nameEl.textContent = g.name;
  nameEl.style.color = rarityColors[g.rarity] || '#e0e0e0';
  nameEl.style.textShadow = `0 0 20px ${rarityGlows[g.rarity] || 'rgba(255,255,255,0.3)'}`;
  document.getElementById('rsiAbility').textContent = g.ability;
  document.getElementById('rsiHp').textContent = `${g.maxHp} HP`;
  document.getElementById('rsiDesc').textContent = g.abilityDesc;
  document.getElementById('rewardSelectedInfo').classList.add('visible');

  // Show Continue button once a card is selected
  document.getElementById('rewardContinueBtn').classList.add('ready');
  document.getElementById('rewardContinueBtn').classList.add('rw-show');
}

function collectRewards() {
  if (selectedRewardCard < 0 && pendingRewardCards.length > 1) return;

  // Add item (max 3)
  if (pendingRewardItem) {
    while (state.items.length >= 3) {
      state.items.shift();
    }
    state.items.push(pendingRewardItem);
  }

  // Add only the selected card
  if (pendingRewardCards.length > 0) {
    const picked = pendingRewardCards[selectedRewardCard >= 0 ? selectedRewardCard : 0];
    state.collection.push(picked);
  }

  saveState();
  showMap();
}

// ══════════════════════════════════════════════
// GAME OVER
// ══════════════════════════════════════════════

function showGameOver() {
  stopMusicHard();
  showScreen('gameoverScreen');

  const graveyard = document.getElementById('graveyard');
  graveyard.innerHTML = '';
  state.deadGhosts.forEach(name => {
    const g = ALL_GHOSTS.find(gh => gh.name === name);
    if (!g) return;
    const c = document.createElement('div');
    c.className = 'grave-card';
    c.innerHTML = `<img src="${IMG}${g.file}">`;
    graveyard.appendChild(c);
  });

  document.getElementById('gameoverStats').innerHTML = `
    Bosses beaten: ${state.stats.bossesBeaten}<br>
    Spiritkin lost: ${state.stats.ghostsLost}<br>
    Total rolls: ${state.stats.totalRolls}
  `;

  clearState();
}

// ══════════════════════════════════════════════
// VICTORY
// ══════════════════════════════════════════════

function showVictory() {
  stopMusicHard();
  startSnow();
  showScreen('winScreen');
  // Restore campaign buttons (hidden during VS)
  document.getElementById('winHofBtn').style.display = '';
  document.getElementById('winKsBtn').style.display = '';

  const wins = state.battleWins || [];
  const deadNames = state.deadGhosts || [];

  // Get unique ghosts that actually won battles
  const winnerNames = [...new Set(wins.map(w => w.ghost))];

  const row = document.getElementById('trophyRow');
  row.innerHTML = '';
  winnerNames.forEach(name => {
    const win = wins.find(w => w.ghost === name);
    const isFallen = deadNames.includes(name);
    const c = document.createElement('div');
    c.className = 'trophy-card' + (isFallen ? ' fallen' : '');
    c.innerHTML = `<img src="${IMG}${win.ghostFile}">${isFallen ? '<div class="fallen-tag">FALLEN</div>' : ''}`;
    row.appendChild(c);
  });

  document.getElementById('winStats').innerHTML = `
    <b>All</b> challengers defeated<br>
    <b>${state.collection.length}</b> Spiritkin survived<br>
    <b>${state.stats.ghostsLost}</b> Spiritkin lost<br>
    <b>${state.stats.itemsUsed}</b> items used<br>
    <b>${state.stats.totalRolls}</b> total rolls
  `;

  // Save to Hall of Fame — grouped by ghost with defeated list
  saveRunToHallOfFame(wins, deadNames, state.killedBy || {});
  clearState();
}

// ══════════════════════════════════════════════
// VS MODE
// ══════════════════════════════════════════════

let vsMode = false;
let vsP1Ghost = null;
let vsP2Ghost = null;
let vsFirstLaunch = true; // true on fresh load / campaign exit, false after first VS pick
let vsPickingPlayer = 1;
let vsSelectedGhost = null;
let vsTurn = 1; // whose turn to roll: 1 or 2

function startVsMode() {
  vsMode = true;
  vsPickingPlayer = 1;
  vsP1Ghost = null;
  vsP2Ghost = null;
  showVsPick(1);
}

function showVsPick(player) {
  vsPickingPlayer = player;
  vsSelectedGhost = null;
  showScreen('vsPickScreen');
  const title = document.getElementById('vsPickTitle');
  const teamName = player === 1 ? 'Blue' : 'Red';
  title.textContent = `${teamName} — Pick Your Spiritkin`;
  title.className = 'vs-pick-title ' + (player === 1 ? 'p1' : 'p2');
  document.getElementById('vsPickBtn').classList.remove('ready');
  document.getElementById('vsSelectedInfo').classList.remove('visible');

  const grid = document.getElementById('vsGhostGrid');
  grid.innerHTML = '';
  // VS pick pool: 7 ghosts. Star ghost in center, high-odds fan favorites, rest random.
  const alreadyPicked = vsP1Ghost ? vsP1Ghost.name : null;
  const pool = ALL_GHOSTS.filter(g => g.name !== alreadyPicked);
  // Star ghosts only on first launch (fresh load / campaign exit)
  const useStar = vsFirstLaunch;
  const starName = player === 1 ? 'The Mountain King' : 'Doom';
  const star = useStar ? pool.find(g => g.name === starName) : null;
  const favNames = ['Kairan', 'Katrina', 'Wim'];
  // 70% chance each favorite is included
  const favs = favNames
    .filter(n => n !== alreadyPicked && (!star || n !== star.name) && Math.random() < 0.70)
    .map(n => pool.find(g => g.name === n))
    .filter(Boolean);
  // Fill remaining slots with random ghosts (mix of rarities)
  const used = new Set([...(star ? [star.name] : []), ...favs.map(g => g.name)]);
  const filler = pool.filter(g => !used.has(g.name)).sort(() => Math.random() - 0.5);
  const totalSlots = 7;
  const slotsNeeded = totalSlots - (star ? 1 : 0) - favs.length;
  const fillerPicks = filler.slice(0, slotsNeeded);

  let available;
  if (star) {
    // Star in center, others around it
    const sides = [...favs, ...fillerPicks].sort(() => Math.random() - 0.5);
    const mid = Math.floor(sides.length / 2);
    available = [...sides.slice(0, mid), star, ...sides.slice(mid)];
  } else {
    // No star — fully random order
    available = [...favs, ...fillerPicks].sort(() => Math.random() - 0.5);
  }

  const cards = [];
  available.forEach(g => {
    const c = document.createElement('div');
    c.className = 'vs-ghost-card';
    c.innerHTML = `<img src="${IMG}${g.file}" alt="${g.name}">`;
    c.onclick = () => selectVsGhost(g, c);
    grid.appendChild(c);
    cards.push({ el: c, ghost: g });
  });

  // Auto-select: star ghost if present, otherwise middle card
  let selectIdx = Math.floor(cards.length / 2);
  if (star) {
    const starIdx = cards.findIndex(c => c.ghost.name === starName);
    if (starIdx >= 0) selectIdx = starIdx;
  }
  setTimeout(() => {
    const defCard = cards[selectIdx];
    if (defCard) {
      defCard.el.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
      selectVsGhost(defCard.ghost, defCard.el);
    }
  }, 50);

  // Auto-select nearest card on scroll stop
  let scrollTimer = null;
  grid.onscroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const gridRect = grid.getBoundingClientRect();
      const centerX = gridRect.left + gridRect.width / 2;
      let closest = null, closestDist = Infinity;
      cards.forEach(({ el, ghost }) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width/2 - centerX);
        if (dist < closestDist) { closestDist = dist; closest = { el, ghost }; }
      });
      if (closest && closest.ghost !== vsSelectedGhost) {
        selectVsGhost(closest.ghost, closest.el);
      }
    }, 100);
  };
}

function selectVsGhost(ghost, el) {
  vsSelectedGhost = ghost;
  const cls = vsPickingPlayer === 1 ? 'selected' : 'p2-selected';
  document.querySelectorAll('.vs-ghost-card').forEach(c => { c.classList.remove('selected', 'p2-selected'); });
  el.classList.add(cls);

  const rarityColors = { common:'#9ca3af', uncommon:'#4ade80', rare:'#60a5fa', 'ghost-rare':'#fbbf24', legendary:'#c084fc' };
  const rarityGlows = { common:'rgba(156,163,175,0.3)', uncommon:'rgba(74,222,128,0.3)', rare:'rgba(96,165,250,0.4)', 'ghost-rare':'rgba(251,191,36,0.4)', legendary:'rgba(192,132,252,0.4)' };
  const nameEl = document.getElementById('vsSiName');
  nameEl.textContent = ghost.name;
  nameEl.style.color = rarityColors[ghost.rarity] || '#e0e0e0';
  nameEl.style.textShadow = `0 0 20px ${rarityGlows[ghost.rarity] || 'rgba(255,255,255,0.3)'}`;
  document.getElementById('vsSiAbility').textContent = ghost.ability;
  document.getElementById('vsSiHp').textContent = `${ghost.maxHp} HP`;
  document.getElementById('vsSiDesc').textContent = ghost.abilityDesc;

  // HP pips
  const pipWrap = document.getElementById('vsSiPips');
  pipWrap.innerHTML = '';
  for (let i = 0; i < ghost.maxHp; i++) {
    const pip = document.createElement('div');
    pip.className = 'si-hp-pip';
    pip.style.animationDelay = (i * 0.06) + 's';
    pipWrap.appendChild(pip);
  }

  document.getElementById('vsSelectedInfo').classList.add('visible');
  document.getElementById('vsPickBtn').classList.add('ready');
}

function confirmVsPick() {
  if (!vsSelectedGhost) return;
  if (vsPickingPlayer === 1) {
    vsP1Ghost = { ...vsSelectedGhost, hp: vsSelectedGhost.maxHp };
    showVsPick(2);
  } else {
    vsP2Ghost = { ...vsSelectedGhost, hp: vsSelectedGhost.maxHp };
    showVsMatchup();
  }
}

function showVsMatchup() {
  showScreen('prebattleScreen');
  document.getElementById('pbTitle').textContent = 'VS Battle';

  document.getElementById('pbPlayerCard').innerHTML = `<img src="${IMG}${vsP1Ghost.file}">`;
  document.getElementById('pbPlayerName').textContent = vsP1Ghost.name;
  document.getElementById('pbEnemyCard').innerHTML = `<img src="${IMG}${vsP2Ghost.file}">`;
  document.getElementById('pbEnemyName').textContent = vsP2Ghost.name;

  document.getElementById('pbStats').innerHTML = `
    <b style="color:var(--player);">${vsP1Ghost.name}</b>: ${vsP1Ghost.ability} · ${vsP1Ghost.maxHp} HP<br>
    <span style="font-size:0.75rem;color:#666;">${vsP1Ghost.abilityDesc}</span><br><br>
    <b style="color:var(--enemy);">${vsP2Ghost.name}</b>: ${vsP2Ghost.ability} · ${vsP2Ghost.maxHp} HP<br>
    <span style="font-size:0.75rem;color:#666;">${vsP2Ghost.abilityDesc}</span>
  `;

  // Hide ghost select (not needed for VS matchup)
  document.getElementById('pbGhostSelect').innerHTML = '';

  const fightBtn = document.getElementById('pbFightBtn');
  fightBtn.textContent = 'FIGHT!';
  fightBtn.classList.add('ready');
  // Temporarily override to launch VS battle, then restore
  fightBtn.setAttribute('onclick', '');
  fightBtn.onclick = () => {
    fightBtn.onclick = null;
    fightBtn.setAttribute('onclick', 'startBattle()');
    fightBtn.textContent = 'Fight!';
    startVsBattle();
  };
}

function startVsBattle() {
  vsFirstLaunch = false; // subsequent VS picks won't force star ghosts
  // P1 = player (bottom), P2 = enemy (top, flipped)
  pick = { ...vsP1Ghost, bossHp: vsP1Ghost.maxHp };
  enemy = { ...vsP2Ghost, bossHp: vsP2Ghost.maxHp };
  playerHp = pick.maxHp;
  enemyHp = enemy.maxHp;
  round = 1;
  phase = 0;
  vsTurn = 1;
  playerPrediction = null;
  enemyPrediction = null;
  rerollMode = false;
  powerMode = 0;
  playerDiceValues = [];
  iceShards = 0; sacredFires = 0;
  enemyIceShards = 0; enemySacredFires = 0;
  playerBonusDice = 0; enemyBonusDice = 0;
  playerRemoveDice = 0; enemyRemoveDice = 0;
  bogeyReflectUsed = false; bogeyReflectArmed = false;
  redBogeyReflectUsed = false; redBogeyReflectArmed = false;
  isFirstRoll = true; tookDamageLastRound = false;
  enemyHeinousUsed = false;
  committedShards = 0; committedFires = 0;
  redCommittedShards = 0; redCommittedFires = 0;
  bossScript = null; bossScriptRound = 0;
  // Chad Sploop!: entry shards for VS (stacks with starting shard)
  if (pick.ability === 'Sploop!') iceShards += 2;
  if (enemy.ability === 'Sploop!') enemyIceShards += 2;
  // Give both players 3 random items
  const itemTypes = ['reroll', 'heal', 'power'];
  battleItemsState = [0,1,2].map(() => ({ id: itemTypes[Math.floor(Math.random()*3)], used: false }));

  showScreen('battleScreen');
  document.getElementById('battleScreen').classList.add('vs-mode');
  document.getElementById('enemyCard').innerHTML = `<img src="${IMG}${enemy.file}">`;
  document.getElementById('playerCard').innerHTML = `<img src="${IMG}${pick.file}">`;
  document.getElementById('enemyNameText').textContent = enemy.name;
  document.getElementById('playerNameText').textContent = pick.name;
  // VS labels
  document.getElementById('diceOwnerEnemy').textContent = 'RED';
  document.getElementById('diceOwnerPlayer').textContent = 'BLUE';
  updateHpDisplay();
  document.getElementById('enemyCard').classList.remove('hit');
  document.getElementById('enemyCard').style.opacity = '1';
  document.getElementById('enemyCard').style.transition = 'none';
  document.getElementById('enemyPlate').style.opacity = '1';
  document.getElementById('enemyPlate').style.transition = 'none';
  document.getElementById('playerCard').classList.remove('hit');
  document.getElementById('predictArea').classList.remove('visible');
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';
  resetDice();
  narrate('');
  document.getElementById('rollBtn').classList.remove('ready');
  document.getElementById('diceArea').classList.add('hidden');
  renderBattleActionBar();
  spawnSpiritParticles();

  const music = document.getElementById('bgMusic');
  music.currentTime = 0; music.volume = 0.4;
  music.play().catch(() => {});

  // Ready-go overlay
  const rgo = document.getElementById('readyGoOverlay');
  const rgt = document.getElementById('readyGoText');
  rgt.textContent = 'FIGHT!';
  rgt.style.animation = 'none';
  rgo.classList.add('active');
  requestAnimationFrame(() => { rgt.style.animation = ''; });
  setTimeout(() => {
    rgo.classList.remove('active');
    document.getElementById('diceArea').classList.remove('hidden');
    vsStartBothRolls();
  }, 1800);
}

// VS turn system: both roll simultaneously
let vsRedRolled = false, vsBlueRolled = false;
let vsRedDice = null, vsBlueDice = null;

function vsStartBothRolls() {
  phase = 0;
  vsRedRolled = false; vsBlueRolled = false;
  vsRedDice = null; vsBlueDice = null;
  vsRoundResolved = false;
  resetDice();
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';
  document.getElementById('predictArea').classList.remove('visible');
  document.getElementById('redPredictArea').classList.remove('visible');
  renderBattleActionBar();
  updateItemUsability();

  // Blue = pick, Red = enemy
  const blueIsPatrick = pick.ability === 'Stone Form';
  const redIsPatrick = enemy.ability === 'Stone Form';
  const blueIsRomy = pick.ability === 'Valley Guardian';
  const redIsRomy = enemy.ability === 'Valley Guardian';

  // Determine who needs predictions before rolling
  const blueNeedsPrediction = blueIsRomy;
  const redNeedsPrediction = redIsRomy;

  if (blueNeedsPrediction) playerPrediction = null;
  if (redNeedsPrediction) enemyPrediction = null;

  // Show prediction pickers for whoever needs them
  if (blueNeedsPrediction || redNeedsPrediction) {
    let msg = '';
    if (blueNeedsPrediction && redNeedsPrediction) {
      msg = 'Both players — Pick a number!';
    } else if (blueNeedsPrediction) {
      msg = 'Blue — Pick a number!';
    } else {
      msg = 'Red — Pick a number!';
    }
    narrate(msg);

    if (blueNeedsPrediction) document.getElementById('predictArea').classList.add('visible');
    if (redNeedsPrediction) document.getElementById('redPredictArea').classList.add('visible');

    // Show roll buttons for non-prediction, non-Patrick players immediately
    if (!blueNeedsPrediction && !blueIsPatrick) document.getElementById('vsBlueRollArea').classList.add('active');
    if (!redNeedsPrediction && !redIsPatrick) document.getElementById('vsRedRollArea').classList.add('active');

    // Handle Patrick auto-rolls
    if (blueIsPatrick) {
      vsBlueRolled = true; vsBlueDice = [0, 0, 0];
      for (let i = 0; i < 3; i++) { const d = document.getElementById('pDie'+i); d.textContent = '—'; d.classList.add('visible'); }
    }
    if (redIsPatrick) {
      vsRedRolled = true; vsRedDice = [0, 0, 0];
      for (let i = 0; i < 3; i++) { const d = document.getElementById('eDie'+i); d.textContent = '—'; d.classList.add('visible'); }
    }
    return;
  }

  // Patrick (blue): auto-roll — Patrick doesn't roll dice
  if (blueIsPatrick) {
    vsBlueRolled = true;
    vsBlueDice = [0, 0, 0];
    for (let i = 0; i < 3; i++) { const d = document.getElementById('pDie'+i); d.textContent = '—'; d.classList.add('visible'); }
  } else {
    document.getElementById('vsBlueRollArea').classList.add('active');
  }

  // Patrick (red): auto-roll — Patrick doesn't roll dice
  if (redIsPatrick) {
    vsRedRolled = true;
    vsRedDice = [0, 0, 0];
    for (let i = 0; i < 3; i++) { const d = document.getElementById('eDie'+i); d.textContent = '—'; d.classList.add('visible'); }
  } else {
    document.getElementById('vsRedRollArea').classList.add('active');
  }

  // Narrate based on Stone Form state
  if (blueIsPatrick && !redIsPatrick) {
    narrate('Blue has Stone Form — Red, tap your ROLL button!');
  } else if (redIsPatrick && !blueIsPatrick) {
    narrate('Red has Stone Form — Blue, tap your ROLL button!');
  } else {
    narrate(`Round ${round} — Both players, roll!`);
  }

  // If both auto-rolled, check immediately
  if (vsBlueRolled && vsRedRolled) {
    setTimeout(vsCheckBothRolled, 800);
  }
}

function vsRedRoll() {
  if (vsRedRolled) return;
  vsRedRolled = true;
  document.getElementById('vsRedRollArea').classList.remove('active');
  playSfx('sfxDiceRoll');
  // Katrina's Seeker: heal before rolling (Red side)
  if (enemy.ability === 'Seeker' && enemyHp < playerHp) {
    enemyHp += 1;
    updateHpDisplay();
  }
  // Piper Slick Coat: -1 enemy die each round
  if (pick && pick.ability === 'Slick Coat') enemyRemoveDice += 1;
  // Use ability-aware dice count
  const eDieCount = getEnemyDiceCount();
  enemyBonusDice = 0; enemyRemoveDice = 0;
  let redRawDice = [];
  // Tommy Salami (Blue): weight Red's dice toward 5/6 (40% per die)
  if (pick && pick.ability === 'Regulator') {
    for (let i = 0; i < eDieCount; i++) {
      if (Math.random() < 0.40) { redRawDice.push(Math.random() < 0.5 ? 5 : 6); }
      else { redRawDice.push(Math.floor(Math.random()*6)+1); }
    }
  } else {
    for (let i = 0; i < eDieCount; i++) redRawDice.push(Math.floor(Math.random()*6)+1);
  }
  // Tommy Salami (Blue): reroll 5s and 6s low
  if (pick && pick.ability === 'Regulator') {
    redRawDice = applyRegulator(redRawDice);
  } else { regulatorBonus = 0; }
  vsRedDice = applyVsDiceModifiers(redRawDice, enemy, false);
  // If more than 3 dice, pick best 3
  if (vsRedDice.length > 3) vsRedDice = bestNOf(vsRedDice, 3);
  const redShowCount = Math.min(vsRedDice.length, 7);
  for (let i = 0; i < redShowCount; i++) { const d = document.getElementById('eDie'+i); d.textContent = '?'; d.classList.add('visible','rolling'); }
  setTimeout(() => {
    vsRedDice.forEach((v, i) => { if (i < 7) setTimeout(() => { const d = document.getElementById('eDie'+i); d.classList.remove('rolling'); d.textContent = v; }, i * 300); });
    setTimeout(vsCheckBothRolled, 1200);
  }, 900);
}

// Apply ghost-specific dice modifiers for VS mode
function applyVsDiceModifiers(dice, ghost, isBlue) {
  const hp = isBlue ? playerHp : enemyHp;
  // Wim's Slash: 15% chance all dice become odd
  if (ghost.ability === 'Slash' && !dice.every(d => d % 2 === 1) && Math.random() < 0.15) {
    dice = dice.map(d => d % 2 === 0 ? d - 1 || 1 : d);
  }
  // Kairan: 10% doubles boost
  if (ghost.ability === "Let's Dance" && Math.random() < 0.10) {
    const v = Math.floor(Math.random()*6)+1; dice[0] = v; dice[1] = v;
  }
  // Guard Thomas: 15% triples, 20% doubles
  if (ghost.ability === 'Stoic') {
    const r = Math.random();
    if (r < 0.15) { const v = Math.floor(Math.random()*6)+1; dice = [v, v, v]; }
    else if (r < 0.35) { const v = Math.floor(Math.random()*6)+1; dice[0] = v; dice[1] = v; }
  }
  // Masked Hero: 1 HP clutch — 40% triples, 30% high doubles
  if (ghost.ability === 'Underdog' && hp === 1) {
    const r = Math.random();
    if (r < 0.40) { const v = Math.ceil(Math.random()*4)+2; dice = dice.map(() => v); }
    else if (r < 0.70) { const v = Math.ceil(Math.random()*3)+3; dice[0] = v; dice[1] = v; }
  }
  return dice;
}

function vsBlueRoll() {
  if (vsBlueRolled) return;
  vsBlueRolled = true;
  document.getElementById('vsBlueRollArea').classList.remove('active');
  playSfx('sfxDiceRoll');
  // Katrina's Seeker: heal before rolling
  if (pick.ability === 'Seeker' && playerHp < enemyHp) {
    playerHp += 1;
    updateHpDisplay();
  }
  // Piper Slick Coat: -1 player die each round (enemy is Piper)
  if (enemy && enemy.ability === 'Slick Coat') playerRemoveDice += 1;
  // Use ability-aware dice count
  const bDieCount = getPlayerDiceCount();
  playerBonusDice = 0; playerRemoveDice = 0;
  let blueRawDice = [];
  // Tommy Salami (Red): weight Blue's dice toward 5/6 (40% per die)
  if (enemy && enemy.ability === 'Regulator') {
    for (let i = 0; i < bDieCount; i++) {
      if (Math.random() < 0.40) { blueRawDice.push(Math.random() < 0.5 ? 5 : 6); }
      else { blueRawDice.push(Math.floor(Math.random()*6)+1); }
    }
  } else {
    for (let i = 0; i < bDieCount; i++) blueRawDice.push(Math.floor(Math.random()*6)+1);
  }
  // Tommy Salami (Red): reroll 5s and 6s low — store bonus for Red's damage calc
  // Note: regulatorBonus is shared, so Red's Regulator uses a separate path in resolveRound
  if (enemy && enemy.ability === 'Regulator') {
    blueRawDice = applyRegulator(blueRawDice);
  }
  vsBlueDice = applyVsDiceModifiers(blueRawDice, pick, true);
  // If more than 3 dice, pick best 3
  if (vsBlueDice.length > 3) vsBlueDice = bestNOf(vsBlueDice, 3);
  const blueShowCount = Math.min(vsBlueDice.length, 7);
  for (let i = 0; i < blueShowCount; i++) { const d = document.getElementById('pDie'+i); d.textContent = '?'; d.classList.add('visible','rolling'); }
  setTimeout(() => {
    vsBlueDice.forEach((v, i) => { if (i < 7) setTimeout(() => { const d = document.getElementById('pDie'+i); d.classList.remove('rolling'); d.textContent = v; }, i * 300); });
    setTimeout(vsCheckBothRolled, 1200);
  }, 900);
}

let vsRoundResolved = false;
function vsCheckBothRolled() {
  if (!vsRedRolled || !vsBlueRolled) return;
  if (vsRoundResolved) return; // prevent double-fire from both timeouts
  vsRoundResolved = true;

  // Patrick (Stone Form) handling — doesn't roll, special resolve
  const blueIsPatrick = pick.ability === 'Stone Form';
  const redIsPatrick = enemy.ability === 'Stone Form';

  if (blueIsPatrick && !redIsPatrick) {
    // Blue is Patrick — resolve Stone Form against red's dice
    currentEnemyRoll = analyzeRoll(vsRedDice);
    playerDiceValues = [];
    // Show red's dice, then resolve Patrick
    setTimeout(() => {
      vsRedDice.forEach((v, i) => { if (currentEnemyRoll.matchDie && v === currentEnemyRoll.matchDie) document.getElementById('eDie'+i).classList.add('glow'); });
    }, 400);
    setTimeout(() => resolvePatrickStoneForm(currentEnemyRoll), 1800);
    return;
  }

  if (redIsPatrick && !blueIsPatrick) {
    // Red is Patrick — resolve against blue's dice
    const pRoll = analyzeRoll(vsBlueDice);
    playerDiceValues = [...vsBlueDice];
    setTimeout(() => {
      vsBlueDice.forEach((v, i) => { if (pRoll.matchDie && v === pRoll.matchDie) document.getElementById('pDie'+i).classList.add('glow'); });
    }, 400);
    // Red Patrick: if blue rolled singles, red negates + 3 damage to blue
    phase = 4;
    setTimeout(() => {
      if (pRoll.type === 'singles') {
        narrate(`<b class="gold">Stone Form!</b> Singles negated — 3 damage to ${pick.name}!`);
        showAbilitySplash('Stone Form', 'Singles negated! 3 damage!', 1600, () => {
          playerHp -= 3;
          playDamageSfx(3);
          document.getElementById('playerCard').classList.add('hit');
          setTimeout(() => document.getElementById('playerCard').classList.remove('hit'), 500);
          updateHpDisplay();
          if (playerHp <= 0) { if (vsMode) { vsHandleLoss(); } else { setTimeout(handlePlayerLoss, 600); } }
          else setTimeout(nextRound, 1400);
        }, 'enemyCard');
      } else {
        // Blue wins normally — Patrick takes damage
        resolveRound(pRoll, { type: 'singles', damage: 0, dice: [0,0,0], total: 0 });
      }
    }, 1800);
    return;
  }

  currentEnemyRoll = analyzeRoll(vsRedDice);
  const pRoll = analyzeRoll(vsBlueDice);
  playerDiceValues = [...vsBlueDice];

  // Highlight matching dice with a pause so players can read
  setTimeout(() => {
    vsRedDice.forEach((v, i) => { if (currentEnemyRoll.matchDie && v === currentEnemyRoll.matchDie) document.getElementById('eDie'+i).classList.add('glow'); });
    vsBlueDice.forEach((v, i) => { if (pRoll.matchDie && v === pRoll.matchDie) document.getElementById('pDie'+i).classList.add('glow'); });
  }, 400);

  if (isTripleOrBetter(currentEnemyRoll.type)) setTimeout(() => showTriplesEffect('enemy', currentEnemyRoll.type), 600);
  if (isTripleOrBetter(pRoll.type)) setTimeout(() => showTriplesEffect('player', pRoll.type), isTripleOrBetter(currentEnemyRoll.type) ? 2200 : 600);
  const triplesDelay = (isTripleOrBetter(currentEnemyRoll.type) || isTripleOrBetter(pRoll.type)) ? 3000 : 0;
  phase = 4;

  // --- VS-specific ability checks before resolveRound ---

  // Kodako Swift: 1-2-3 → negate damage and deal 4
  const blueKodako = pick.ability === 'Swift' && vsBlueDice.length >= 3 && [1,2,3].every(v => vsBlueDice.includes(v));
  const redKodako = enemy.ability === 'Swift' && vsRedDice.length >= 3 && [1,2,3].every(v => vsRedDice.includes(v));

  if (blueKodako || redKodako) {
    setTimeout(() => {
      if (blueKodako && redKodako) {
        // Both Kodako — both trigger, net zero, treat as tie
        showAbilitySplash('Swift', '1-2-3! Both sides trigger — Tie!', 1600, () => {
          narrate(`<b class="gold">Swift!</b> Both players rolled 1-2-3 — cancels out!`);
          setTimeout(nextRound, 1400);
        }, 'playerCard');
      } else if (blueKodako) {
        showAbilitySplash('Swift', '1-2-3! Negate damage, deal 4!', 1600, () => {
          enemyHp -= 4; playDamageSfx(4);
          narrate(`<b class="gold">Swift! 4 damage to ${enemy.name}!</b>`);
          document.getElementById('enemyCard').classList.add('hit');
          setTimeout(() => document.getElementById('enemyCard').classList.remove('hit'), 500);
          updateHpDisplay();
          if (enemyHp <= 0) setTimeout(enemyDefeated, 600);
          else setTimeout(nextRound, 1400);
        }, 'playerCard');
      } else {
        showAbilitySplash('Swift', '1-2-3! Negate damage, deal 4!', 1600, () => {
          playerHp -= 4; playDamageSfx(4);
          narrate(`<b class="them">Swift! 4 damage to ${pick.name}!</b>`);
          document.getElementById('playerCard').classList.add('hit');
          setTimeout(() => document.getElementById('playerCard').classList.remove('hit'), 500);
          updateHpDisplay();
          if (playerHp <= 0) { if (vsMode) { vsHandleLoss(); } else { setTimeout(handlePlayerLoss, 600); } }
          else setTimeout(nextRound, 1400);
        }, 'enemyCard');
      }
    }, 1800 + triplesDelay);
    return;
  }

  // Bubble Boys Pop: if opponent rolls triples, Bubble Boys are defeated
  const bluePopTriggered = pick.ability === 'Pop' && isTripleOrBetter(currentEnemyRoll.type);
  const redPopTriggered = enemy.ability === 'Pop' && isTripleOrBetter(pRoll.type);

  if (bluePopTriggered || redPopTriggered) {
    setTimeout(() => {
      if (bluePopTriggered && redPopTriggered) {
        // Both Bubble Boys popped — double KO, Red wins (enemy advantage on tie)
        narrate(`<b class="them">Pop!</b> Both Bubble Boys burst!`);
        playerHp = 0; enemyHp = 0; updateHpDisplay();
        setTimeout(() => { fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
      } else if (bluePopTriggered) {
        narrate(`<b class="them">Pop!</b> ${pick.name} burst!`);
        playerHp = 0; updateHpDisplay();
        setTimeout(() => { fadeOutMusic(); setTimeout(handlePlayerLoss, 1500); }, 600);
      } else {
        narrate(`<b class="gold">Pop!</b> ${enemy.name} burst!`);
        enemyHp = 0; updateHpDisplay();
        setTimeout(enemyDefeated, 600);
      }
    }, 1800 + triplesDelay);
    return;
  }

  // Extra pause so both players can see the dice before damage resolves
  setTimeout(() => resolveRound(pRoll, currentEnemyRoll), 1800 + triplesDelay);
}

// Override win/loss for VS mode
function vsShowResult(winnerName, winnerFile, winnerLabel, loserName, loserFile, winnerHp, winnerMaxHp) {
  fadeOutMusic();
  stopSpiritParticles();
  document.getElementById('battleScreen').classList.remove('vs-mode');
  document.getElementById('vsRedRollArea').classList.remove('active');
  document.getElementById('vsBlueRollArea').classList.remove('active');
  document.getElementById('redPredictArea').classList.remove('visible');
  document.getElementById('predictArea').classList.remove('visible');
  document.getElementById('diceOwnerEnemy').textContent = 'Enemy';
  document.getElementById('diceOwnerPlayer').textContent = 'You';
  document.getElementById('rollBtn').textContent = 'Roll Your Dice!';
  document.getElementById('rollBtn').onclick = () => doPlayerRoll();
  stopSnow(); startSnow();
  showScreen('winScreen');

  // Color-coded winner display
  const winTitle = document.querySelector('.win-title');
  const winScreen = document.getElementById('winScreen');
  winScreen.classList.remove('vs-blue-wins', 'vs-red-wins');
  const isBlue = winnerLabel === 'Blue';
  winScreen.classList.add(isBlue ? 'vs-blue-wins' : 'vs-red-wins');
  winTitle.textContent = `${winnerLabel} Wins!`;

  // Hide campaign-only buttons in VS
  document.getElementById('winHofBtn').style.display = 'none';
  document.getElementById('winKsBtn').style.display = 'none';

  // Big winner card with loser faded behind
  document.getElementById('trophyRow').innerHTML = `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="trophy-card" style="width:80px;height:112px;position:absolute;left:-30px;top:20px;opacity:0.25;filter:grayscale(0.8) brightness(0.4);transform:rotate(-8deg);z-index:0;"><img src="${IMG}${loserFile}"></div>
      <div class="trophy-card" style="width:180px;height:252px;border-color:${isBlue ? 'rgba(103,232,249,0.6)' : 'rgba(248,113,113,0.6)'};box-shadow:0 0 40px ${isBlue ? 'rgba(103,232,249,0.3)' : 'rgba(248,113,113,0.3)'};z-index:1;"><img src="${IMG}${winnerFile}"></div>
    </div>
  `;

  // Fight summary
  const closeness = winnerHp <= 2 ? 'A razor-thin victory!' : winnerHp <= Math.ceil(winnerMaxHp/2) ? 'A hard-fought win!' : 'A dominant performance!';
  document.getElementById('winStats').innerHTML = `
    <b>${winnerName}</b> defeats <b>${loserName}</b><br>
    <b>${round}</b> rounds · ${winnerHp}/${winnerMaxHp} HP remaining<br>
    <span style="color:${isBlue ? 'var(--player)' : 'var(--enemy)'};">${closeness}</span>
  `;
}

function vsHandleWin() { vsShowResult(pick.name, pick.file, 'Blue', enemy.name, enemy.file, playerHp, pick.maxHp); }
function vsHandleLoss() { vsShowResult(enemy.name, enemy.file, 'Red', pick.name, pick.file, enemyHp, enemy.maxHp); }

// ══════════════════════════════════════════════
// CO-OP 2v2 CAMPAIGN MODE
// ══════════════════════════════════════════════

function startCoopMode() {
  coopMode = true;
  vsMode = false;
  coopState = newCoopState();
  coopPickingPlayer = 1;
  coopSelectedGhost = null;
  iceShards = 0; sacredFires = 0;
  showCoopStarterPick(1);
}

// ══════════════════════════════════════════════
// CO-OP 2v2 CAMPAIGN
// ══════════════════════════════════════════════

let coopRewardPlayer = 1;           // which player is currently picking a reward ghost
let coopPendingRewardCards1 = [];   // P1's 2 drawn cards
let coopPendingRewardCards2 = [];   // P2's 2 drawn cards
let coopSelectedRewardIdx = -1;
let coopRewardRevealedCards = new Set();
let coopBossPartner = null;         // the boss's partner ghost for current fight

// ── STARTER PICK ──

function showCoopStarterPick(player) {
  coopPickingPlayer = player;
  coopSelectedGhost = null;

  const title = document.getElementById('vsPickTitle');
  const grid = document.getElementById('vsGhostGrid');
  const info = document.getElementById('vsSelectedInfo');
  const btn = document.getElementById('vsPickBtn');

  title.textContent = `Player ${player} — Pick Your Starter`;
  title.style.color = player === 1 ? 'var(--player)' : 'var(--gold)';
  info.style.display = 'none';
  btn.classList.remove('ready');
  btn.onclick = confirmCoopPick;

  // Build starter pool
  let pool;
  if (player === 1) {
    // P1 picks from all 3 starters
    pool = STARTER_NAMES.map(name => ALL_GHOSTS.find(g => g.name === name)).filter(Boolean);
  } else {
    // P2 picks from remaining 2 (exclude P1's pick)
    const p1Name = coopState.p1.collection[0]?.name;
    pool = STARTER_NAMES.filter(n => n !== p1Name).map(name => ALL_GHOSTS.find(g => g.name === name)).filter(Boolean);
  }

  grid.innerHTML = '';
  const rarityColors = { common: '#9ca3af', uncommon: '#60a5fa', rare: '#c084fc', 'ghost-rare': '#f472b6' };
  pool.forEach(ghost => {
    const card = document.createElement('div');
    card.className = 'vs-ghost-card';
    card.innerHTML = `
      <div class="vs-card-img-wrap">
        <img src="${IMG}${ghost.file}" alt="${ghost.name}">
      </div>
      <div class="vs-card-name" style="color:${rarityColors[ghost.rarity] || '#fff'}">${ghost.name}</div>
    `;
    card.onclick = () => selectCoopGhost(ghost, card);
    grid.appendChild(card);
  });

  showScreen('vsPickScreen');
}

function selectCoopGhost(ghost, el) {
  coopSelectedGhost = { ...ghost };
  const grid = document.getElementById('vsGhostGrid');
  grid.querySelectorAll('.vs-ghost-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  const info = document.getElementById('vsSelectedInfo');
  info.style.display = 'block';
  document.getElementById('vsSiName').textContent = ghost.name;
  document.getElementById('vsSiAbility').textContent = ghost.ability;
  document.getElementById('vsSiHp').textContent = `${ghost.maxHp} HP`;
  document.getElementById('vsSiDesc').textContent = ghost.abilityDesc;

  // HP pips
  const pips = document.getElementById('vsSiPips');
  pips.innerHTML = '';
  for (let i = 0; i < ghost.maxHp; i++) {
    const pip = document.createElement('div');
    pip.className = 'si-hp-pip';
    pip.style.animationDelay = `${i * 60}ms`;
    pips.appendChild(pip);
  }

  document.getElementById('vsPickBtn').classList.add('ready');
}

function confirmCoopPick() {
  if (!coopSelectedGhost) return;
  const ghost = { ...coopSelectedGhost, hp: coopSelectedGhost.maxHp };

  if (coopPickingPlayer === 1) {
    coopState.p1.collection.push(ghost);
    saveCoopState();
    showCoopStarterPick(2);
  } else {
    coopState.p2.collection.push(ghost);
    saveCoopState();
    showCoopMap();
  }
}

// ── BOSS PARTNER GENERATION ──

function generateBossPartner(bossIndex) {
  // Collect names already in play (both player collections + current boss)
  const usedNames = new Set([
    ...coopState.p1.collection.map(g => g.name),
    ...coopState.p2.collection.map(g => g.name),
    BOSSES[bossIndex].name
  ]);

  let rarities, hpBonus;
  if (bossIndex <= 3) {
    // Early fights: commons/uncommons, +0-1 HP
    rarities = ['common', 'uncommon'];
    hpBonus = Math.floor(Math.random() * 2); // 0 or 1
  } else if (bossIndex <= 7) {
    // Mid fights: uncommons/rares, +1-2 HP
    rarities = ['uncommon', 'rare'];
    hpBonus = 1 + Math.floor(Math.random() * 2); // 1 or 2
  } else {
    // Late fights: rares/ghost-rares, +2-3 HP
    rarities = ['rare', 'ghost-rare'];
    hpBonus = 2 + Math.floor(Math.random() * 2); // 2 or 3
  }

  let pool = ALL_GHOSTS.filter(g => rarities.includes(g.rarity) && !usedNames.has(g.name));
  // Fallback: if pool is empty, allow any non-legendary
  if (pool.length === 0) pool = ALL_GHOSTS.filter(g => g.rarity !== 'legendary' && !usedNames.has(g.name));
  if (pool.length === 0) pool = ALL_GHOSTS.filter(g => g.rarity !== 'legendary');

  const base = pool[Math.floor(Math.random() * pool.length)];
  const partner = { ...base };
  partner.hp = partner.maxHp + hpBonus;
  partner.maxHp = partner.hp;
  return partner;
}

// ── CAMPAIGN MAP ──

function showCoopMap() {
  const bossIdx = coopState.currentBoss;
  const boss = BOSSES[bossIdx];
  const location = BOSS_LOCATIONS[bossIdx] || 'Unknown';
  const theme = LOCATION_THEMES[location] || { bg: 'linear-gradient(180deg, #0a0a1a, #1a1a2a)', accent: '#67e8f9' };

  // Generate the boss's partner for this fight
  coopBossPartner = generateBossPartner(bossIdx);

  // Repurpose the matchup screen as a campaign map
  const screen = document.getElementById('coopMatchupScreen');

  screen.innerHTML = `
    <div class="coop-map-header">
      <div class="coop-map-fight-num">BATTLE ${bossIdx + 1} OF 12</div>
      <div class="coop-map-location" style="color:${theme.accent}">${location}</div>
      <div class="coop-map-progress" id="coopProgress"></div>
    </div>

    <div class="coop-map-enemies">
      <div class="coop-map-enemy-card">
        <div class="coop-map-enemy-label" style="color:var(--enemy);">BOSS</div>
        <img src="${IMG}${boss.file}" class="coop-map-card-img">
        <div class="coop-map-enemy-name">${boss.name}</div>
        <div class="coop-map-enemy-stats">${boss.bossHp} HP &middot; ${boss.ability}</div>
        <div class="coop-map-enemy-desc">${boss.abilityDesc}</div>
      </div>
      <div class="coop-map-enemy-card">
        <div class="coop-map-enemy-label" style="color:var(--enemy);">PARTNER</div>
        <img src="${IMG}${coopBossPartner.file}" class="coop-map-card-img">
        <div class="coop-map-enemy-name">${coopBossPartner.name}</div>
        <div class="coop-map-enemy-stats">${coopBossPartner.maxHp} HP &middot; ${coopBossPartner.ability}</div>
      </div>
    </div>

    <div class="coop-map-teams">
      <div class="coop-map-team">
        <div class="coop-map-team-label" style="color:var(--player);">P1 Team</div>
        <div class="coop-map-ghosts" id="coopMapP1Ghosts"></div>
        <div class="coop-map-items" id="coopMapP1Items"></div>
      </div>
      <div class="coop-map-team">
        <div class="coop-map-team-label" style="color:var(--gold);">P2 Team</div>
        <div class="coop-map-ghosts" id="coopMapP2Ghosts"></div>
        <div class="coop-map-items" id="coopMapP2Items"></div>
      </div>
    </div>

    <button class="action-btn cyan ready" id="coopFightBtn" style="font-size:1.3rem;">FIGHT!</button>
    <button class="small-btn" onclick="coopMode=false;clearCoopState();showScreen('titleScreen');initTitle();">Abandon Run</button>
  `;

  // Apply theme
  screen.style.background = theme.bg;

  // Progress bar
  const progress = document.getElementById('coopProgress');
  for (let i = 0; i < 12; i++) {
    const node = document.createElement('div');
    node.className = 'progress-node';
    if (i < bossIdx) node.classList.add('defeated');
    else if (i === bossIdx) node.classList.add('current');
    else node.classList.add('upcoming');
    if (i >= 8) node.classList.add('legendary');
    progress.appendChild(node);
  }

  // Render P1 team
  const p1Container = document.getElementById('coopMapP1Ghosts');
  coopState.p1.selectedIdx = 0;
  coopState.p1.collection.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb selectable' + (i === 0 ? ' selected' : '');
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="ghost-hp-tag">${g.hp}/${g.maxHp}</div>`;
    el.onclick = () => {
      coopState.p1.selectedIdx = i;
      p1Container.querySelectorAll('.team-ghost-thumb.selectable').forEach((t, j) => t.classList.toggle('selected', j === i));
    };
    p1Container.appendChild(el);
  });
  // P1 dead ghosts
  coopState.p1.deadGhosts.forEach(name => {
    const g = ALL_GHOSTS.find(gh => gh.name === name);
    if (!g) return;
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb dead';
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="dead-x">\u2715</div>`;
    p1Container.appendChild(el);
  });

  // Render P2 team
  const p2Container = document.getElementById('coopMapP2Ghosts');
  coopState.p2.selectedIdx = 0;
  coopState.p2.collection.forEach((g, i) => {
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb selectable' + (i === 0 ? ' selected' : '');
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="ghost-hp-tag">${g.hp}/${g.maxHp}</div>`;
    el.onclick = () => {
      coopState.p2.selectedIdx = i;
      p2Container.querySelectorAll('.team-ghost-thumb.selectable').forEach((t, j) => t.classList.toggle('selected', j === i));
    };
    p2Container.appendChild(el);
  });
  // P2 dead ghosts
  coopState.p2.deadGhosts.forEach(name => {
    const g = ALL_GHOSTS.find(gh => gh.name === name);
    if (!g) return;
    const el = document.createElement('div');
    el.className = 'team-ghost-thumb dead';
    el.innerHTML = `<img src="${IMG}${g.file}"><div class="dead-x">\u2715</div>`;
    p2Container.appendChild(el);
  });

  // Render items for each player
  const renderItems = (containerId, items) => {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    (items || []).forEach(id => {
      const item = ITEMS[id];
      if (!item) return;
      const d = document.createElement('div');
      d.className = 'team-item-icon';
      d.textContent = item.icon;
      el.appendChild(d);
    });
    // Empty slots
    for (let i = (items || []).length; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'team-item-icon empty';
      d.textContent = '\u00B7';
      el.appendChild(d);
    }
  };
  renderItems('coopMapP1Items', coopState.p1.items);
  renderItems('coopMapP2Items', coopState.p2.items);

  // Fight button
  document.getElementById('coopFightBtn').onclick = startCoopBattle;

  showScreen('coopMatchupScreen');
}

// ── BATTLE SETUP ──

function startCoopBattle() {
  const bossIdx = coopState.currentBoss;
  const boss = BOSSES[bossIdx];

  // Copy selected ghosts for the fight
  const p1Ghost = coopState.p1.collection[coopState.p1.selectedIdx || 0];
  const p2Ghost = coopState.p2.collection[coopState.p2.selectedIdx || 0];
  coopP1 = { ...p1Ghost };
  coopP2 = { ...p2Ghost };
  coopE1 = { ...boss, hp: boss.bossHp, maxHp: boss.bossHp };
  coopE2 = { ...coopBossPartner };

  coopP1Hp = coopP1.hp;
  coopP2Hp = coopP2.hp;
  coopE1Hp = coopE1.bossHp || coopE1.maxHp;
  coopE2Hp = coopE2.maxHp;
  coopTurn = 1;
  coopTarget = 1;
  coopRound = 0;

  // Set up boss script for E1 (same logic as regular campaign)
  bossScriptRound = 0;
  if (bossIdx === 0) {
    bossScript = BOSS0_SCRIPTS[coopP1.name] || null;
  } else {
    const scripts = [null, BOSS1_SCRIPT, BOSS2_SCRIPT, BOSS3_SCRIPT, BOSS4_SCRIPT, BOSS5_SCRIPT, BOSS6_SCRIPT, BOSS7_SCRIPT, BOSS8_SCRIPT, BOSS9_SCRIPT, BOSS10_SCRIPT, BOSS11_SCRIPT];
    const useScript = bossIdx <= 2 || Math.random() < 0.5;
    bossScript = useScript ? (varyScript(scripts[bossIdx]) || null) : null;
  }

  // Map P1 as active player
  coopMapToBattle();

  // Reset all battle state
  round = 1;
  phase = 'roll';
  isFirstRoll = true;
  tookDamageLastRound = false;
  bogeyReflectUsed = false;
  bogeyReflectArmed = false;
  enemyHeinousUsed = false;
  iceShards = 0; sacredFires = 0;
  enemyIceShards = 0; enemySacredFires = 0;
  committedShards = 0; committedFires = 0;
  playerBonusDice = 0; enemyBonusDice = 0;
  playerRemoveDice = 0; enemyRemoveDice = 0;
  rerollMode = false;
  powerMode = 0;

  // Set up battle items from P1's inventory (active player)
  battleItemsState = (coopState.p1.items || []).map(id => ({ id, used: false }));

  // Boss entry abilities
  if (coopE1.ability === 'Sploop!') enemyIceShards += 2;

  const battleScreen = document.getElementById('battleScreen');
  battleScreen.classList.add('coop-mode');
  battleScreen.classList.remove('vs-mode');

  showScreen('battleScreen');
  renderCoopPanels();
  updateCoopPanels();

  // Show cards and names
  document.getElementById('playerCard').innerHTML = `<img src="${IMG}${pick.file}" style="width:100%;height:100%;object-fit:cover;">`;
  document.getElementById('enemyCard').innerHTML = `<img src="${IMG}${enemy.file}" style="width:100%;height:100%;object-fit:cover;">`;
  document.getElementById('playerNameText').textContent = pick.name;
  document.getElementById('enemyNameText').textContent = enemy.name;
  document.getElementById('diceOwnerPlayer').textContent = `P${coopTurn}`;
  document.getElementById('diceOwnerEnemy').textContent = enemy.name;

  updateHpDisplay();
  resetDice();
  renderBattleActionBar();

  // Reset card visibility
  document.getElementById('enemyCard').style.opacity = '1';
  document.getElementById('enemyCard').style.transition = 'none';
  document.getElementById('enemyPlate').style.opacity = '1';
  document.getElementById('enemyPlate').style.transition = 'none';
  document.getElementById('predictArea').classList.remove('visible');
  document.getElementById('diceArea').classList.add('hidden');
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';
  document.getElementById('rollBtn').classList.remove('ready');

  spawnSpiritParticles();
  const music = document.getElementById('bgMusic');
  music.currentTime = 0;
  music.volume = 0.4;
  music.play().catch(() => {});

  // Ready-go overlay
  const rgo = document.getElementById('readyGoOverlay');
  const rgt = document.getElementById('readyGoText');
  rgt.textContent = 'FIGHT!';
  rgt.style.animation = 'none';
  rgo.classList.add('active');
  requestAnimationFrame(() => { rgt.style.animation = ''; });
  setTimeout(() => {
    rgo.classList.remove('active');
    document.getElementById('diceArea').classList.remove('hidden');
    narrate(`<b style="color:var(--player)">Player ${coopTurn}</b>'s turn! Target: <b style="color:var(--enemy)">${enemy.name}</b>`);
    setTimeout(doEnemyRoll, 1000);
  }, 1800);
}

// ── BATTLE STATE MAPPING ──

function coopMapToBattle() {
  // Map the active player and target to the battle globals
  pick = coopTurn === 1 ? { ...coopP1 } : { ...coopP2 };
  enemy = coopTarget === 1 ? { ...coopE1 } : { ...coopE2 };
  playerHp = coopTurn === 1 ? coopP1Hp : coopP2Hp;
  enemyHp = coopTarget === 1 ? coopE1Hp : coopE2Hp;

  // Swap battle items to active player's inventory
  const activePlayer = coopTurn === 1 ? coopState.p1 : coopState.p2;
  battleItemsState = (activePlayer.items || []).map(id => ({ id, used: false }));
}

function coopSyncFromBattle() {
  // Write battle results back to co-op state
  if (coopTurn === 1) coopP1Hp = playerHp;
  else coopP2Hp = playerHp;
  if (coopTarget === 1) coopE1Hp = enemyHp;
  else coopE2Hp = enemyHp;
}

function coopSelectTarget(t) {
  // Can't target dead enemies
  if (t === 1 && coopE1Hp <= 0) return;
  if (t === 2 && coopE2Hp <= 0) return;
  coopTarget = t;

  // Remap enemy
  enemy = t === 1 ? { ...coopE1 } : { ...coopE2 };
  enemyHp = t === 1 ? coopE1Hp : coopE2Hp;

  // Update main battle display
  document.getElementById('enemyCard').innerHTML = `<img src="${IMG}${enemy.file}" style="width:100%;height:100%;object-fit:cover;">`;
  document.getElementById('enemyNameText').textContent = enemy.name;
  document.getElementById('diceOwnerEnemy').textContent = enemy.name;
  updateHpDisplay();
  updateCoopPanels();

  narrate(`Targeting <b style="color:var(--enemy)">${enemy.name}</b>!`);
}

// ── ROUND RESOLUTION ──

function coopAfterRound() {
  coopSyncFromBattle();
  updateCoopPanels();

  // Check if targeted enemy died
  const targetHp = coopTarget === 1 ? coopE1Hp : coopE2Hp;
  if (targetHp <= 0) {
    // Check if both enemies dead = boss defeated
    if (coopE1Hp <= 0 && coopE2Hp <= 0) {
      setTimeout(() => coopBossDefeated(), 800);
      return;
    }
    // Auto-target surviving enemy
    narrate(`<b style="color:var(--enemy)">${enemy.name}</b> is defeated!`);
  }

  // Check if active player's ghost died
  const activeHp = coopTurn === 1 ? coopP1Hp : coopP2Hp;
  if (activeHp <= 0) {
    coopHandlePlayerDeath();
    return;
  }

  // Switch turns
  setTimeout(() => coopNextTurn(), 1200);
}

function coopNextTurn() {
  // Alternate turns, skip dead players
  let nextTurn = coopTurn === 1 ? 2 : 1;
  const nextHp = nextTurn === 1 ? coopP1Hp : coopP2Hp;
  if (nextHp <= 0) nextTurn = coopTurn; // stay on surviving player
  coopTurn = nextTurn;

  // Auto-target surviving enemy if current target dead
  if (coopTarget === 1 && coopE1Hp <= 0) coopTarget = 2;
  if (coopTarget === 2 && coopE2Hp <= 0) coopTarget = 1;

  coopRound++;

  // Remap battle globals (also swaps items)
  coopMapToBattle();

  // Boss script only applies when targeting E1 (the actual boss)
  // Reset per-turn state but keep bossScript alive
  bossScriptRound = coopTarget === 1 ? bossScriptRound : 0;

  // Reset round state
  round = 1;
  isFirstRoll = true;
  tookDamageLastRound = false;
  bogeyReflectUsed = false;
  bogeyReflectArmed = false;
  playerBonusDice = 0; enemyBonusDice = 0;
  playerRemoveDice = 0; enemyRemoveDice = 0;
  committedShards = 0; committedFires = 0;
  rerollMode = false;
  powerMode = 0;

  // Update display
  document.getElementById('playerCard').innerHTML = `<img src="${IMG}${pick.file}" style="width:100%;height:100%;object-fit:cover;">`;
  document.getElementById('enemyCard').innerHTML = `<img src="${IMG}${enemy.file}" style="width:100%;height:100%;object-fit:cover;">`;
  document.getElementById('playerNameText').textContent = pick.name;
  document.getElementById('enemyNameText').textContent = enemy.name;
  document.getElementById('diceOwnerPlayer').textContent = `P${coopTurn}`;
  document.getElementById('diceOwnerEnemy').textContent = enemy.name;

  updateHpDisplay();
  resetDice();
  updateCoopPanels();
  renderBattleActionBar();

  // Reset card visibility
  document.getElementById('enemyCard').style.opacity = '1';
  document.getElementById('enemyCard').style.transition = 'none';
  document.getElementById('enemyPlate').style.opacity = '1';
  document.getElementById('enemyPlate').style.transition = 'none';
  document.getElementById('predictArea').classList.remove('visible');
  for (let i = 3; i < 7; i++) document.getElementById('pDie'+i).style.display = 'none';
  document.getElementById('rollBtn').classList.remove('ready');

  narrate(`<b style="color:var(--player)">Player ${coopTurn}</b>'s turn! Target: <b style="color:var(--enemy)">${enemy.name}</b>`);
  setTimeout(doEnemyRoll, 1000);
}

// ── PLAYER DEATH (PERMADEATH) ──

function coopHandlePlayerDeath() {
  const deadTurn = coopTurn;
  const pState = deadTurn === 1 ? coopState.p1 : coopState.p2;
  const deadGhost = deadTurn === 1 ? coopP1 : coopP2;

  // Remove from collection
  const idx = pState.collection.findIndex(g => g.name === deadGhost.name);
  if (idx !== -1) pState.collection.splice(idx, 1);
  pState.deadGhosts.push(deadGhost.name);
  pState.killedBy[deadGhost.name] = enemy.name;
  coopState.stats.ghostsLost++;
  saveCoopState();

  // Show farewell overlay
  stopMusicHard();
  const overlay = document.getElementById('farewellOverlay');
  document.getElementById('farewellCard').innerHTML = `<img src="${IMG}${deadGhost.file}">`;
  document.getElementById('farewellName').textContent = deadGhost.name;
  document.getElementById('farewellText').textContent = 'Farewell...';
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');

    // Check if both players have no ghosts left
    if (coopState.p1.collection.length === 0 && coopState.p2.collection.length === 0) {
      coopGameOver();
      return;
    }

    // Check if both battle ghosts are dead (both HP <= 0)
    if (coopP1Hp <= 0 && coopP2Hp <= 0) {
      // Both active ghosts in this fight are dead — but players may still have bench ghosts
      // For now, treat this fight as a loss; return to map so they can pick new fighters
      if (coopState.p1.collection.length === 0 && coopState.p2.collection.length === 0) {
        coopGameOver();
      } else {
        // Still have ghosts — go back to map to pick new fighters
        stopSpiritParticles();
        document.getElementById('battleScreen').classList.remove('coop-mode');
        showCoopMap();
      }
      return;
    }

    // One player's ghost still alive — continue fighting
    narrate(`<b style="color:var(--player)">${deadGhost.name}</b> has fallen! Partner continues!`);
    setTimeout(() => coopNextTurn(), 800);
  }, 4000);
}

// ── BOSS DEFEATED ──

function coopBossDefeated() {
  fadeOutMusic();
  stopSpiritParticles();
  document.getElementById('battleScreen').classList.remove('coop-mode');

  // Heal all ghosts to full HP
  coopState.p1.collection.forEach(g => { g.hp = g.maxHp; });
  coopState.p2.collection.forEach(g => { g.hp = g.maxHp; });

  // Track battle wins
  const boss = BOSSES[coopState.currentBoss];
  coopState.p1.battleWins.push({ ghost: coopP1.name, ghostFile: coopP1.file, boss: boss.name });
  coopState.p2.battleWins.push({ ghost: coopP2.name, ghostFile: coopP2.file, boss: boss.name });
  coopState.stats.bossesBeaten++;

  coopState.currentBoss++;
  saveCoopState();

  if (coopState.currentBoss >= 12) {
    coopVictory();
  } else {
    showCoopRewards();
  }
}

// ── REWARDS ──

function showCoopRewards() {
  const prevBoss = coopState.currentBoss - 1;
  const boss = BOSSES[prevBoss];
  const weights = DRAW_WEIGHTS[prevBoss];

  // Item drop — both players get the same item type
  const itemDrop = boss.drop;

  // Draw 2 cards for each player
  coopPendingRewardCards1 = [];
  coopPendingRewardCards2 = [];
  for (let i = 0; i < 2; i++) {
    const c1 = drawGhost(weights);
    if (c1) coopPendingRewardCards1.push(c1);
    const c2 = drawGhost(weights);
    if (c2) coopPendingRewardCards2.push(c2);
  }

  // Add items to both players (max 3)
  if (itemDrop) {
    [coopState.p1, coopState.p2].forEach(p => {
      while (p.items.length >= 3) p.items.shift();
      p.items.push(itemDrop);
    });
    saveCoopState();
  }

  // Start with P1's reward pick
  coopRewardPlayer = 1;
  showCoopRewardPick();
}

function showCoopRewardPick() {
  const isP1 = coopRewardPlayer === 1;
  const cards = isP1 ? coopPendingRewardCards1 : coopPendingRewardCards2;
  const prevBoss = coopState.currentBoss - 1;
  const boss = BOSSES[prevBoss];

  showScreen('rewardScreen');

  // Reset animations
  document.querySelectorAll('.rw-anim').forEach(el => el.classList.remove('rw-show'));
  document.getElementById('rewardSelectedInfo').classList.remove('visible');
  document.getElementById('rewardContinueBtn').classList.remove('ready');

  // Title — show which player is picking
  const titleEl = document.getElementById('rewardTitle');
  if (titleEl) {
    titleEl.textContent = isP1 ? 'Player 1 — Choose a Spiritkin' : 'Player 2 — Choose a Spiritkin';
    titleEl.style.color = isP1 ? 'var(--player)' : 'var(--gold)';
  }

  // Item display (show once for P1, skip for P2 since already collected)
  if (isP1 && boss.drop) {
    const item = ITEMS[boss.drop];
    document.getElementById('rewardItemIcon').textContent = item.icon;
    document.getElementById('rewardItemName').textContent = item.name;
    document.getElementById('rewardItemDesc').textContent = item.desc + ' (both players)';
    document.getElementById('rewardItemBox').style.display = 'flex';
    document.getElementById('rewardOverflow').style.display = 'none';
  } else {
    document.getElementById('rewardItemBox').style.display = 'none';
    document.getElementById('rewardOverflow').style.display = 'none';
  }

  // Render ghost cards
  coopSelectedRewardIdx = -1;
  coopRewardRevealedCards = new Set();

  const container = document.getElementById('rewardCards');
  container.innerHTML = '';
  const rarityBadgeClass = r => r === 'ghost-rare' ? 'ghost-rare' : r === 'legendary' ? 'legendary' : r;
  const rarityLabel = r => (r === 'ghost-rare' || r === 'legendary') ? 'LEGEND' : r.toUpperCase();

  cards.forEach((g, i) => {
    const c = document.createElement('div');
    c.className = 'reward-card rc-facedown';
    c.innerHTML = `
      <div class="rc-back"><img src="${CARDBACK}" alt=""><div class="rc-back-text">Tap to Reveal</div></div>
      <div class="rc-rarity rarity-badge ${rarityBadgeClass(g.rarity)}">${rarityLabel(g.rarity)}</div>
      <img src="${IMG}${g.file}">
      <div class="rc-name">${g.name}</div>
      <div class="rc-ability">${g.ability} \u00B7 ${g.maxHp} HP</div>
    `;
    c.onclick = () => coopRewardRevealAndSelect(i);
    container.appendChild(c);
  });

  // Override continue button to use co-op flow
  const continueBtn = document.getElementById('rewardContinueBtn');
  continueBtn.onclick = coopCollectReward;

  // Staggered entrance
  const stagger = [
    { el: 'rewardTitle', delay: 200 },
    { el: 'rewardItemBox', delay: 700 },
    { el: 'rewardGhostLabel', delay: 1200 },
    { el: null, delay: 1400, action: () => document.querySelector('.reward-cards')?.classList.add('rw-show') },
  ];
  stagger.forEach(({ el, delay, action }) => {
    setTimeout(() => {
      if (el) document.getElementById(el)?.classList.add('rw-show');
      if (action) action();
    }, delay);
  });

  // Auto-reveal if only 1 card
  if (cards.length === 1) {
    setTimeout(() => coopRewardRevealAndSelect(0), 1800);
  }
}

function coopRewardRevealAndSelect(idx) {
  const cards = document.querySelectorAll('#rewardCards .reward-card');
  const card = cards[idx];

  if (!coopRewardRevealedCards.has(idx)) {
    coopRewardRevealedCards.add(idx);
    card.classList.remove('rc-facedown');
    card.classList.add('rc-revealed');
    playSfx('sfxSpecial', 0.6);
    setTimeout(() => coopSelectRewardCard(idx), 300);
    return;
  }
  coopSelectRewardCard(idx);
}

function coopSelectRewardCard(idx) {
  coopSelectedRewardIdx = idx;
  const isP1 = coopRewardPlayer === 1;
  const pendingCards = isP1 ? coopPendingRewardCards1 : coopPendingRewardCards2;
  const cards = document.querySelectorAll('#rewardCards .reward-card');
  const rarityColors = {
    common: '#9ca3af', uncommon: '#4ade80', rare: '#60a5fa',
    'ghost-rare': '#fbbf24', legendary: '#c084fc'
  };

  cards.forEach((c, i) => {
    if (coopRewardRevealedCards.has(i)) {
      c.classList.remove('rc-facedown');
      c.classList.toggle('rc-selected', i === idx);
      c.classList.toggle('rc-dimmed', i !== idx && coopRewardRevealedCards.has(i));
    }
  });

  const g = pendingCards[idx];
  const rarityGlows = {
    common: 'rgba(156,163,175,0.3)', uncommon: 'rgba(74,222,128,0.3)',
    rare: 'rgba(96,165,250,0.4)', 'ghost-rare': 'rgba(251,191,36,0.4)', legendary: 'rgba(192,132,252,0.4)'
  };
  const nameEl = document.getElementById('rsiName');
  nameEl.textContent = g.name;
  nameEl.style.color = rarityColors[g.rarity] || '#e0e0e0';
  nameEl.style.textShadow = `0 0 20px ${rarityGlows[g.rarity] || 'rgba(255,255,255,0.3)'}`;
  document.getElementById('rsiAbility').textContent = g.ability;
  document.getElementById('rsiHp').textContent = `${g.maxHp} HP`;
  document.getElementById('rsiDesc').textContent = g.abilityDesc;
  document.getElementById('rewardSelectedInfo').classList.add('visible');

  document.getElementById('rewardContinueBtn').classList.add('ready');
  document.getElementById('rewardContinueBtn').classList.add('rw-show');
}

function coopCollectReward() {
  const isP1 = coopRewardPlayer === 1;
  const pendingCards = isP1 ? coopPendingRewardCards1 : coopPendingRewardCards2;
  const pState = isP1 ? coopState.p1 : coopState.p2;

  if (coopSelectedRewardIdx < 0 && pendingCards.length > 1) return;

  // Add the selected ghost to current player's collection
  if (pendingCards.length > 0) {
    const picked = pendingCards[coopSelectedRewardIdx >= 0 ? coopSelectedRewardIdx : 0];
    pState.collection.push({ ...picked, hp: picked.maxHp });
  }

  saveCoopState();

  if (isP1) {
    // Show P2's reward pick
    coopRewardPlayer = 2;
    showCoopRewardPick();
  } else {
    // Both players picked — back to map
    // Restore the continue button for regular campaign use
    document.getElementById('rewardContinueBtn').onclick = collectRewards;
    showCoopMap();
  }
}

// ── VICTORY & GAME OVER ──

function coopVictory() {
  stopSpiritParticles();
  stopMusicHard();
  startSnow();
  document.getElementById('battleScreen').classList.remove('coop-mode');

  document.getElementById('winScreen').querySelector('.win-title').textContent = 'Co-op Victory!';
  const trophyRow = document.getElementById('trophyRow');
  trophyRow.innerHTML = '';

  // Show all surviving ghosts from both teams
  const allSurvivors = [...coopState.p1.collection, ...coopState.p2.collection];
  allSurvivors.forEach(g => {
    const div = document.createElement('div');
    div.className = 'trophy-ghost';
    div.innerHTML = `<img src="${IMG}${g.file}" style="width:80px;border-radius:12px;"><div style="font-family:Creepster;margin-top:4px;">${g.name}</div>`;
    trophyRow.appendChild(div);
  });

  const totalDeaths = coopState.p1.deadGhosts.length + coopState.p2.deadGhosts.length;
  document.getElementById('winStats').innerHTML = `
    <b>12 Bosses Defeated!</b><br>
    <b>Spiritkin Lost:</b> ${totalDeaths}<br>
    <b>P1 Survivors:</b> ${coopState.p1.collection.length} &middot; <b>P2 Survivors:</b> ${coopState.p2.collection.length}
  `;

  // Hide campaign-only buttons
  const hofBtn = document.getElementById('winHofBtn');
  if (hofBtn) hofBtn.style.display = 'none';
  const ksBtn = document.getElementById('winKsBtn');
  if (ksBtn) ksBtn.style.display = 'none';

  showScreen('winScreen');
  clearCoopState();
}

function coopGameOver() {
  stopSpiritParticles();
  stopMusicHard();
  document.getElementById('battleScreen').classList.remove('coop-mode');

  document.getElementById('gameoverScreen').querySelector('.gameover-title').textContent = 'Co-op Defeated!';
  const graveyard = document.getElementById('graveyard');
  graveyard.innerHTML = '';

  // Show all dead ghosts from both players
  const allDead = [...coopState.p1.deadGhosts, ...coopState.p2.deadGhosts];
  allDead.forEach(name => {
    const g = ALL_GHOSTS.find(gh => gh.name === name);
    if (!g) return;
    const div = document.createElement('div');
    div.className = 'grave-card';
    div.innerHTML = `<img src="${IMG}${g.file}" style="filter:grayscale(1) brightness(0.5);">`;
    graveyard.appendChild(div);
  });

  document.getElementById('gameoverStats').innerHTML = `
    <b>Bosses beaten:</b> ${coopState.stats.bossesBeaten}<br>
    <b>Spiritkin lost:</b> ${coopState.stats.ghostsLost}<br>
    <b>Fell at:</b> ${BOSS_NAMES[coopState.currentBoss] || 'Unknown'}
  `;

  showScreen('gameoverScreen');
  clearCoopState();
}

// ── COOP PANEL RENDERING ──

function renderCoopPanels() {
  const setSlot = (prefix, ghost) => {
    document.getElementById(prefix + 'Img').src = IMG + ghost.file;
    document.getElementById(prefix + 'Name').textContent = ghost.name;
  };
  setSlot('coopP1', coopP1);
  setSlot('coopP2', coopP2);
  setSlot('coopE1', coopE1);
  setSlot('coopE2', coopE2);
}

function updateCoopPanels() {
  const updateSlot = (prefix, hp, maxHp, isDead) => {
    document.getElementById(prefix + 'HpText').textContent = `${Math.max(0, hp)}/${maxHp}`;
    document.getElementById(prefix + 'Bar').style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    const slot = document.getElementById(prefix + 'Slot');
    if (isDead) slot.classList.add('dead');
    else slot.classList.remove('dead');
  };

  updateSlot('coopP1', coopP1Hp, coopP1.maxHp, coopP1Hp <= 0);
  updateSlot('coopP2', coopP2Hp, coopP2.maxHp, coopP2Hp <= 0);
  updateSlot('coopE1', coopE1Hp, coopE1.maxHp, coopE1Hp <= 0);
  updateSlot('coopE2', coopE2Hp, coopE2.maxHp, coopE2Hp <= 0);

  // Highlight active player
  document.getElementById('coopP1Slot').classList.toggle('active', coopTurn === 1 && coopP1Hp > 0);
  document.getElementById('coopP2Slot').classList.toggle('active', coopTurn === 2 && coopP2Hp > 0);

  // Highlight targeted enemy
  document.getElementById('coopE1Slot').classList.toggle('targeted', coopTarget === 1 && coopE1Hp > 0);
  document.getElementById('coopE2Slot').classList.toggle('targeted', coopTarget === 2 && coopE2Hp > 0);

  // Turn indicator
  document.getElementById('coopTurnIndicator').textContent = `P${coopTurn}'s Turn`;
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
initTitle();
