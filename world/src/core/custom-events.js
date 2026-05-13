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

  // Spawn Valkin east of town (path from Dark Castle), walk to the tavern/plaza
  const spawnX = (HUB.x + 15) * T; // east on the path, NOT on the lake
  const spawnY = (HUB.y + 3) * T;
  const targetX = (HUB.x + 3) * T; // tavern/plaza area center
  const targetY = (HUB.y + 4) * T;

  const valkinSprite = scene.physics.add.sprite(spawnX, spawnY, 'npc_elder');
  valkinSprite.setDepth(10);
  valkinSprite.setTint(0xcc66ff);
  valkinSprite.setScale(2.5); // bigger than normal NPCs

  // Label
  const valkinLabel = scene.add.text(spawnX, spawnY - 20, 'Valkin the Grand', {
    fontSize: '10px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#cc66ff',
    backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
  }).setOrigin(0.5).setDepth(11);

  // Title
  const titleLabel = scene.add.text(spawnX, spawnY - 32, '★ The Corruptor ★', {
    fontSize: '8px', fontFamily: 'monospace', color: '#ff8844',
  }).setOrigin(0.5).setDepth(11);

  // Store reference — phase: 'approaching' → 'declaring' → 'hunting'
  scene._valkinEvent = {
    sprite: valkinSprite,
    label: valkinLabel,
    titleLabel: titleLabel,
    event: event,
    active: true,
    phase: 'approaching', // walking to town center
    targetX: targetX,
    targetY: targetY,
    lastAmbient: Date.now(),
    huntTarget: null,
    declareTime: 0,
    spawnTime: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  };

  // Announce approach
  valkinChat('I have arrived. Tremble before Valkin the Grand!');
  if (typeof notify === 'function') notify('⚠ VALKIN THE GRAND APPROACHES! ⚠');

  // Update loop — handles all phases
  scene._valkinUpdateFn = () => updateValkinEvent(scene);
}

// ── Unified Valkin event update (approach → declare → hunt) ──
function updateValkinEvent(scene) {
  if (!scene._valkinEvent || !scene._valkinEvent.active) return;
  const v = scene._valkinEvent;
  const T = 32;

  // Check expiry (30 min)
  if (Date.now() > v.expiresAt) {
    valkinChat('This land bores me. I will return.');
    v.sprite.destroy(); v.label.destroy(); v.titleLabel.destroy();
    scene._valkinEvent = null;
    return;
  }

  // Update label positions
  v.label.setPosition(v.sprite.x, v.sprite.y - 20);
  v.titleLabel.setPosition(v.sprite.x, v.sprite.y - 32);

  // ── PHASE: APPROACHING ──
  if (v.phase === 'approaching') {
    const dx = v.targetX - v.sprite.x;
    const dy = v.targetY - v.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 8) {
      // Walk toward hub center at 1.5 tiles/sec
      const speed = 1.5 * T * 0.016;
      const angle = Math.atan2(dy, dx);
      v.sprite.x += Math.cos(angle) * speed;
      v.sprite.y += Math.sin(angle) * speed;

      // Trash talk while walking (every 8 seconds)
      if (Date.now() - v.lastAmbient > 8000) {
        v.lastAmbient = Date.now();
        const walkLines = [
          'Your little village amuses me.',
          'I grow tired of waiting. Who dares approach?',
          'The spirits tremble at my name.',
        ];
        valkinChat(walkLines[Math.floor(Math.random() * walkLines.length)]);
      }

      // If player walks into Valkin during approach, fight
      const px = scene.player.x, py = scene.player.y;
      const pDist = Phaser.Math.Distance.Between(px, py, v.sprite.x, v.sprite.y);
      if (pDist < 30 && !G.inBattle) {
        triggerValkinBattle(scene);
      }
    } else {
      // Arrived at town center — declare war
      v.phase = 'declaring';
      v.declareTime = Date.now();
      valkinChat('Attention Citizens! By right, I Valkin the Grand am the ruler of this land. Declare war against the Intruders!');
      if (typeof notify === 'function') notify('⚠ VALKIN DECLARES WAR! ⚠');
    }
  }

  // ── PHASE: DECLARING (3 second pause before hunting) ──
  if (v.phase === 'declaring') {
    if (Date.now() - v.declareTime > 3000) {
      v.phase = 'hunting';
      valkinChat('Now... who wants to go first?');

      // NOW set up collision with player
      scene.physics.add.overlap(scene.player, v.sprite, () => {
        if (G.inBattle || !scene._valkinEvent?.active) return;
        triggerValkinBattle(scene);
      });
    }
  }

  // ── PHASE: HUNTING — attack NPCs and chase player ──
  if (v.phase === 'hunting') {
    const vx = v.sprite.x, vy = v.sprite.y;

    // Hunt nearest NPC first, then player
    if (!v._npcCooldown) v._npcCooldown = 0;
    const now = Date.now();

    // Attack nearby NPCs (every 4 seconds)
    if (now - v._npcCooldown > 4000 && scene.npcSprites) {
      for (const npc of scene.npcSprites) {
        if (npc._valkinDestroyed) continue;
        const npcDist = Phaser.Math.Distance.Between(vx, vy, npc.x, npc.y);
        if (npcDist < 60) {
          // Fire effect on NPC
          const fire = scene.add.circle(npc.x, npc.y, 20, 0xff4400, 0.8).setDepth(15);
          scene.tweens.add({
            targets: fire, scaleX: 2, scaleY: 2, alpha: 0, duration: 600,
            onComplete: () => fire.destroy(),
          });
          // Screen shake
          scene.cameras.main.shake(200, 0.003);

          // "Destroy" the NPC (hide sprite + label, mark as destroyed)
          if (npc.sprite) npc.sprite.setVisible(false);
          if (npc.label) npc.label.setVisible(false);
          if (npc.marker) npc.marker.setVisible(false);
          if (npc._hint) { npc._hint.destroy(); npc._hint = null; }
          npc._valkinDestroyed = true;

          // Kill count + trash talk
          v.event.hunt.killCount = (v.event.hunt.killCount || 0) + 1;
          const kc = v.event.hunt.killCount;
          valkinChat('Kill Count ' + kc);
          if (kc % 5 === 0) valkinChat('Kill-takular!');

          // Respawn NPC after 5 minutes
          scene.time.delayedCall(5 * 60 * 1000, () => {
            if (npc.sprite) npc.sprite.setVisible(true);
            if (npc.label) npc.label.setVisible(true);
            if (npc.marker) npc.marker.setVisible(true);
            npc._valkinDestroyed = false;
          });

          v._npcCooldown = now;
          break; // one NPC per tick
        }
      }
    }

    // Chase the player
    const px = scene.player.x, py = scene.player.y;
    const pDist = Phaser.Math.Distance.Between(vx, vy, px, py);
    if (pDist < v.event.hunt.aggroRange * T && pDist > 20) {
      const speed = v.event.hunt.speed * T * 0.016;
      const angle = Math.atan2(py - vy, px - vx);
      v.sprite.x += Math.cos(angle) * speed;
      v.sprite.y += Math.sin(angle) * speed;
    } else if (pDist <= 30 && !G.inBattle) {
      triggerValkinBattle(scene);
    }

    // Ambient trash talk every 20 seconds
    if (now - v.lastAmbient > 20000) {
      v.lastAmbient = now;
      const line = v.event.ambientLines[Math.floor(Math.random() * v.event.ambientLines.length)];
      valkinChat(line);
    }
  }
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

  // Use new battle engine factory
  const playerIds = playerGhosts.map(g => g.id);
  const enemyIds = enemyGhosts.map(g => g.id);
  if (typeof initBattle === 'function') {
    initBattle(playerIds, enemyIds, { type: 'valkin', isValkinEvent: true });
    // Override enemy HP with Valkin event custom values (Valkin = 30 HP, not card default)
    if (B) {
      const eTeam = B.red ? B.blue : B.enemy;
      if (eTeam) {
        event.team.forEach((member, idx) => {
          if (eTeam.ghosts[idx]) {
            eTeam.ghosts[idx].hp = member.hp;
            eTeam.ghosts[idx].maxHp = member.hp;
          }
        });
      }
    }
  }

  // Launch battle scene THEN pause (correct order)
  scene.cameras.main.fadeOut(300, 0, 0, 0);
  scene.time.delayedCall(300, () => {
    scene.scene.launch('BattleScene', {
      trainerName: 'Valkin the Grand',
      _valkinEvent: true,
    });
    scene.scene.pause();
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
