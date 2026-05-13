// ══════════════════════════════════════════════════════════
//  CUSTOM WORLD EVENTS
//  Special boss encounters with dialogue, phases, and world behavior
// ══════════════════════════════════════════════════════════

// ─── VALKIN THE GRAND — World Event Boss ────────────────
// Team order: Raditz (62) → Valkin (432) → Bigsby (424)
// Valkin has 30 HP. Raditz & Bigsby have normal HP.
// After battle: Valkin hunts players in town, talks trash in world chat.

const VALKIN_EVENT = {
  name: 'Valkin the Grand',
  title: 'The Corruptor',
  team: [
    { cardId: 62,  name: 'Raditz',          hp: 6,  role: 'lead' },
    { cardId: 432, name: 'Valkin the Grand', hp: 30, role: 'boss' },
    { cardId: 424, name: 'Bigsby',           hp: 5,  role: 'closer' },
  ],
  art: 'https://drbango.com/testroom/art/originals/ValkinTheGrand.png',
  color: '#cc66ff',

  // ── Battle dialogue triggers ──────────────────────────
  battleDialogue: {
    // Valkin loses 10 HP from his max
    onDamageMilestone: function(bossHp, bossMaxHp) {
      if (bossHp <= bossMaxHp - 10 && !this._said10hp) {
        this._said10hp = true;
        return { face: true, text: "You're good, but I'm better.", color: '#cc66ff' };
      }
      if (bossHp <= 5 && bossHp >= 1 && !this._saidLowHp) {
        this._saidLowHp = true;
        return { face: true, text: "I will not lose!!!", color: '#ff4444' };
      }
      return null;
    },

    // Valkin KOs a player's spiritkin
    onPlayerKO: function(koName) {
      return { face: true, text: "Too Easy.", color: '#cc66ff' };
    },

    // Valkin uses Sacred Fire
    onResourceUsed: function(resourceType) {
      if (resourceType === 'sacredFire') {
        return { face: true, text: "Let's turn up the heat!", color: '#ff8844' };
      }
      return null;
    },

    // Valkin enters from sideline
    onBossEntry: function() {
      return { face: true, text: "Did you really think my servants could fall? Now face ME.", color: '#cc66ff' };
    },

    // Bigsby enters (last stand)
    onCloserEntry: function() {
      return { face: false, text: "Bigsby steps forward, clutching a dark orb...", color: '#aa88cc' };
    },

    // Battle state tracking (reset per encounter)
    _said10hp: false,
    _saidLowHp: false,
  },

  // ── Town hunt behavior ────────────────────────────────
  // After spawning or winning a battle, Valkin roams town hunting
  hunt: {
    killCount: 0,
    speed: 1.5, // tiles per second (faster than player)
    aggroRange: 8, // tiles

    onKill: function(targetName) {
      this.killCount++;
      const count = this.killCount;

      // Every 5 kills: special line
      if (count % 5 === 0) {
        const specials = [
          "Kill-takular!",
          "Attention Citizens! By right, I Valkin the Grand am the ruler of this land. Declare war against the Intruders!",
          "Is there no one left who dares challenge me?",
          "This land bows to ME now.",
          "Kill-takular!",
        ];
        const line = specials[Math.floor((count / 5 - 1) % specials.length)];
        valkinChat(line);
        return { face: true, text: line, color: '#cc66ff', announce: true };
      }

      // Normal kill line
      valkinChat("Kill Count " + count);
      return { face: false, text: "Kill Count " + count, color: '#cc66ff' };
    },

    // Reset on new event
    reset: function() { this.killCount = 0; },
  },

  // ── Chat lines for ambient presence ───────────────────
  ambientLines: [
    "I grow tired of waiting. Who dares approach?",
    "The spirits tremble at my name.",
    "Your little village amuses me.",
    "I've conquered realms far greater than this.",
    "Beg for mercy. I might consider it... briefly.",
  ],
};

// ── Send chat as Valkin (uses his name, not the player's) ──
function valkinChat(text) {
  if (typeof db === 'undefined' || db._stub) {
    // Offline: inject directly into WorldScene chat if available
    if (typeof GameChat !== 'undefined' && GameChat._onMessage) {
      GameChat._onMessage({ name: 'Valkin the Grand', text: text, level: 99, ts: Date.now() });
    }
    return;
  }
  // Online: push to Firebase with Valkin's name
  try {
    const region = GameChat._currentRegion || 'frost_valley';
    db.ref('chat/' + region).push({
      name: 'Valkin the Grand',
      text: text.slice(0, 200),
      level: 99,
      ts: firebase.database.ServerValue.TIMESTAMP,
    });
  } catch(e) {
    // Fallback: inject locally
    if (typeof GameChat !== 'undefined' && GameChat._onMessage) {
      GameChat._onMessage({ name: 'Valkin the Grand', text: text, level: 99, ts: Date.now() });
    }
  }
}

// ── Spawn Valkin Event ─────────────────────────────────
// Call this to start the Valkin world event
function spawnValkinEvent(scene) {
  if (!scene || !scene.player) return;

  const T = 32;
  const event = VALKIN_EVENT;
  event.hunt.reset();
  event.battleDialogue._said10hp = false;
  event.battleDialogue._saidLowHp = false;

  // Announce in world chat as Valkin
  valkinChat('I have arrived. Tremble before Valkin the Grand!');
  if (typeof notify === 'function') {
    notify('⚠ VALKIN THE GRAND HAS APPEARED! ⚠');
  }

  // Spawn Valkin NPC in the hub area
  const hubX = 55, hubY = 30; // Near Polaris Hub
  const valkinSprite = scene.physics.add.sprite(hubX * T, hubY * T, 'npc_elder');
  valkinSprite.setDepth(10);
  valkinSprite.setTint(0xcc66ff);

  // Label
  const valkinLabel = scene.add.text(hubX * T, hubY * T - 16, 'Valkin the Grand', {
    fontSize: '9px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#cc66ff',
    backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
  }).setOrigin(0.5).setDepth(11);

  // Title
  const titleLabel = scene.add.text(hubX * T, hubY * T - 26, '★ The Corruptor ★', {
    fontSize: '7px', fontFamily: 'monospace', color: '#ff8844',
  }).setOrigin(0.5).setDepth(11);

  // Store reference
  scene._valkinEvent = {
    sprite: valkinSprite,
    label: valkinLabel,
    titleLabel: titleLabel,
    event: event,
    active: true,
    lastAmbient: Date.now(),
    huntTarget: null,
  };

  // Collision with player triggers the boss battle
  scene.physics.add.overlap(scene.player, valkinSprite, () => {
    if (G.inBattle || !scene._valkinEvent.active) return;
    triggerValkinBattle(scene);
  });

  // Update loop for hunting behavior
  scene._valkinUpdateFn = () => updateValkinHunt(scene);
}

// ── Trigger Valkin Boss Battle ──────────────────────────
function triggerValkinBattle(scene) {
  if (!scene._valkinEvent || G.inBattle) return;

  G.inBattle = true;
  const event = VALKIN_EVENT;

  // Build enemy team: Raditz → Valkin → Bigsby
  const enemyGhosts = event.team.map(member => {
    const card = ALL_CARDS.find(c => c.id === member.cardId) || {};
    return {
      id: member.cardId,
      name: member.name,
      hp: member.hp,
      maxHp: member.hp,
      ko: false,
      ability: card.ability || '',
      abilityDesc: card.desc || '',
      rarity: card.rarity || 'legendary',
      usedOncePerGame: false,
      entryFired: false,
      _isValkinEvent: true,
      _role: member.role,
    };
  });

  const playerGhosts = buildPlayerBattleTeam();
  const _resources = {
    iceShards: G.iceShards || 0, sacredFire: G.sacredFire || 0,
    healingSeeds: G.healingSeeds || 0, luckyStones: G.luckyStones || 0,
    surge: G.surge || 0, moonstone: G.moonstone || 0, firefly: G.firefly || 0,
  };

  B = {
    round: 1,
    player: { ghosts: playerGhosts, activeIdx: 0, resources: { ..._resources } },
    enemy: { ghosts: enemyGhosts, activeIdx: 0, resources: { iceShards: 0, sacredFire: 0, healingSeeds: 0, luckyStones: 0, surge: 0, moonstone: 0, firefly: 0 } },
    enemyCard: ALL_CARDS.find(c => c.id === 62), // Start with Raditz
    phase: 'ready', log: [], playerDice: [], enemyDice: [],
    nextRoundMods: { playerExtraDice: 0, enemyExtraDice: 0, playerMaxDice: 99, enemyMaxDice: 99 },
    resources: { ..._resources },
    entryFired: false, enemyUsedResource: false, damageTakenThisRound: 0,
    koSwapTeam: null, committed: {},
    _valkinEvent: true,
    _valkinDialogue: event.battleDialogue,
  };

  // Show entry dialogue
  const entryLine = event.battleDialogue.onBossEntry();

  scene.scene.pause();
  scene.scene.launch('BattleScene', {
    trainerName: 'Valkin the Grand',
    _valkinEvent: true,
  });
}

// ── Update Valkin Hunt AI (called each frame from WorldScene) ──
function updateValkinHunt(scene) {
  if (!scene._valkinEvent || !scene._valkinEvent.active) return;

  const v = scene._valkinEvent;
  const T = 32;

  // Move Valkin toward nearest player/NPC
  const vx = v.sprite.x;
  const vy = v.sprite.y;
  const px = scene.player.x;
  const py = scene.player.y;
  const dist = Phaser.Math.Distance.Between(vx, vy, px, py);

  // Hunt the player
  if (dist < v.event.hunt.aggroRange * T && dist > 20) {
    const speed = v.event.hunt.speed * T * 0.016; // per frame at ~60fps
    const angle = Math.atan2(py - vy, px - vx);
    v.sprite.x += Math.cos(angle) * speed;
    v.sprite.y += Math.sin(angle) * speed;
  }

  // Update label positions
  v.label.setPosition(v.sprite.x, v.sprite.y - 16);
  v.titleLabel.setPosition(v.sprite.x, v.sprite.y - 26);

  // Ambient chat lines every 30 seconds
  if (Date.now() - v.lastAmbient > 30000) {
    v.lastAmbient = Date.now();
    const line = v.event.ambientLines[Math.floor(Math.random() * v.event.ambientLines.length)];
    valkinChat(line);
  }
}

// ── Show Valkin Face Dialogue (portrait + text popup) ───
function showValkinDialogue(scene, text, color) {
  if (!scene) return;
  const W = scene.scale.width;

  // Portrait frame (top center)
  const portrait = scene.add.image(W / 2 - 120, 60, '__DEFAULT');
  // Load Valkin art if available
  if (scene.textures.exists('valkin_portrait')) {
    portrait.setTexture('valkin_portrait');
  }
  portrait.setDisplaySize(60, 60).setScrollFactor(0).setDepth(600);

  const bg = scene.add.rectangle(W / 2 + 20, 60, 300, 50, 0x1a1a2e, 0.95)
    .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color || '#cc66ff').color)
    .setScrollFactor(0).setDepth(600);

  const nameText = scene.add.text(W / 2 - 20, 45, 'Valkin the Grand', {
    fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#cc66ff',
  }).setScrollFactor(0).setDepth(601);

  const dialogText = scene.add.text(W / 2 - 20, 62, text, {
    fontSize: '11px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: color || '#ffffff',
    wordWrap: { width: 260 },
  }).setScrollFactor(0).setDepth(601);

  // Auto-dismiss after 4 seconds
  scene.tweens.add({
    targets: [portrait, bg, nameText, dialogText],
    alpha: 0, duration: 1000, delay: 3000,
    onComplete: () => {
      portrait.destroy(); bg.destroy(); nameText.destroy(); dialogText.destroy();
    },
  });
}
