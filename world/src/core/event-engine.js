// ══════════════════════════════════════════════════════════
//  EVENT SCRIPT ENGINE — Battle of Origins World
//  Data-driven event system: define character events as
//  config objects, the engine runs the state machine.
//
//  Usage:
//    EventEngine.start(MY_EVENT_SCRIPT, scene);
//    // In WorldScene.update():  EventEngine.update(this);
// ══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const T = 32; // tile size

  // ── Coordinate resolver ──
  // Supports numbers or strings like "HUB.x + 15"
  function resolveCoord(expr) {
    if (typeof expr === 'number') return expr;
    if (typeof expr !== 'string') return 0;
    // Replace known hub references
    let s = expr;
    const hubs = {
      HUB: typeof HUB !== 'undefined' ? HUB : { x: 0, y: 0 },
      HUB_MEADOW: typeof HUB_MEADOW !== 'undefined' ? HUB_MEADOW : { x: 24, y: 58 },
      HUB_VOLCANIC: typeof HUB_VOLCANIC !== 'undefined' ? HUB_VOLCANIC : { x: 74, y: 16 },
      HUB_DARK: typeof HUB_DARK !== 'undefined' ? HUB_DARK : { x: 93, y: 20 },
    };
    for (const [name, hub] of Object.entries(hubs)) {
      s = s.replace(new RegExp(name + '\\.x', 'g'), hub.x);
      s = s.replace(new RegExp(name + '\\.y', 'g'), hub.y);
    }
    try { return Function('"use strict"; return (' + s + ')')(); }
    catch (e) { console.warn('[EventEngine] Bad coord expr:', expr, e); return 0; }
  }

  // ── Active event instances ──
  const _active = new Map();

  // ── Action executors registry ──
  // Each returns 'done', 'running', or 'persistent'
  const _executors = {};

  function registerAction(name, fn) { _executors[name] = fn; }

  // ══════════════════════════════════════════
  //  BUILT-IN ACTION EXECUTORS
  // ══════════════════════════════════════════

  // ── comm: scene.comm.show() — fire-and-forget ──
  registerAction('comm', function (inst, scene, action, state) {
    if (scene && scene.comm) {
      scene.comm.show(action.speaker || inst.script.name, action.text, {
        color: action.color, duration: action.duration || 3000,
      });
    }
    return 'done';
  });

  // ── blockingComm: shows dialogue, waits for E key or click to dismiss ──
  registerAction('blockingComm', function (inst, scene, action, state) {
    if (!state._started) {
      state._started = true;
      state._done = false;
      state._minTime = Date.now() + 500; // prevent instant dismiss from same click
      console.log('[EventEngine] blockingComm started:', action.text);
      // Freeze player
      if (scene.player && scene.player.setVelocity) scene.player.setVelocity(0, 0);
      if (scene.player) scene.player._eventFrozen = true;
      // Show comm
      if (scene && scene.comm) {
        scene.comm.show(action.speaker || inst.script.name, action.text, {
          color: action.color, duration: 999999,
        });
      }
      // Use Phaser's input system (works even when canvas captures events)
      if (scene && scene.input) {
        scene.input.on('pointerdown', function _bcClick() {
          if (Date.now() < state._minTime) return; // ignore clicks in first 500ms
          state._done = true;
          scene.input.off('pointerdown', _bcClick);
        });
      }
      // Also listen for keyboard via Phaser
      if (scene && scene.input && scene.input.keyboard) {
        var eKey = scene.input.keyboard.addKey('E');
        var spaceKey = scene.input.keyboard.addKey('SPACE');
        state._phaserKeys = [eKey, spaceKey];
      }
    }
    // Check Phaser keys
    if (state._phaserKeys && Date.now() >= state._minTime) {
      state._phaserKeys.forEach(function (k) {
        if (k && Phaser.Input.Keyboard.JustDown(k)) state._done = true;
      });
    }
    if (state._done) {
      console.log('[EventEngine] blockingComm dismissed');
      // Clear Phaser key listeners
      if (state._phaserKeys) {
        state._phaserKeys.forEach(function (k) {
          if (k && scene.input && scene.input.keyboard) scene.input.keyboard.removeKey(k.keyCode);
        });
      }
      // Clear comm
      if (scene && scene.comm && scene.comm.hide) scene.comm.hide();
      // Unfreeze player (battle action will re-freeze if needed)
      if (scene.player) scene.player._eventFrozen = false;
      return 'done';
    }
    // Keep player frozen while waiting
    if (scene.player && scene.player.setVelocity) scene.player.setVelocity(0, 0);
    return 'running';
  });

  // ── waitForInteract: blocks until player presses E near this NPC ──
  registerAction('waitForInteract', function (inst, scene, action, state) {
    if (!inst.sprite || !scene.player) return 'running';
    // Debounce: ignore for 500ms after phase start to prevent instant re-trigger
    if (!state._readyAt) state._readyAt = Date.now() + 500;
    if (Date.now() < state._readyAt) return 'running';

    const dist = Phaser.Math.Distance.Between(inst.sprite.x, inst.sprite.y, scene.player.x, scene.player.y);
    const range = (action.range || 80);
    // Show [E] hint when close
    if (dist < range && !inst._interactHint) {
      inst._interactHint = scene.add.text(inst.sprite.x, inst.sprite.y + 24, '[E]', {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(12);
    } else if (dist >= range && inst._interactHint) {
      inst._interactHint.destroy(); inst._interactHint = null;
    }
    // Check E press while in range
    if (dist < range && scene.input && scene.input.keyboard) {
      if (!state._eKey) state._eKey = scene.input.keyboard.addKey('E');
      if (Phaser.Input.Keyboard.JustDown(state._eKey)) {
        if (inst._interactHint) { inst._interactHint.destroy(); inst._interactHint = null; }
        if (state._eKey) { scene.input.keyboard.removeKey(state._eKey.keyCode); state._eKey = null; }
        return 'done';
      }
    }
    return 'running';
  });

  // ── freezePlayer: lock player movement until unfreezePlayer ──
  registerAction('freezePlayer', function (inst, scene, action) {
    if (scene.player) {
      if (scene.player.setVelocity) scene.player.setVelocity(0, 0);
      scene.player._eventFrozen = true;
      // Safety: auto-unfreeze after 8s if still frozen (prevents permanent stuck)
      if (scene.time) {
        scene.time.delayedCall(8000, function () {
          if (scene.player && scene.player._eventFrozen && !G.inBattle) {
            console.warn('[EventEngine] Safety unfreeze — player was stuck');
            scene.player._eventFrozen = false;
          }
        });
      }
    }
    return 'done';
  });

  // ── unfreezePlayer: restore movement ──
  registerAction('unfreezePlayer', function (inst, scene, action) {
    if (scene.player) scene.player._eventFrozen = false;
    return 'done';
  });

  // ── starfoxComm: StarfoxComm.play() — blocking until dismissed ──
  registerAction('starfoxComm', function (inst, scene, action, state) {
    if (!state._started) {
      state._started = true;
      state._done = false;
      if (typeof StarfoxComm !== 'undefined') {
        StarfoxComm.play(action.lines, {
          warning: action.warning,
          dark: action.dark,
          onComplete: function () { state._done = true; },
        });
      } else {
        state._done = true;
      }
    }
    return state._done ? 'done' : 'running';
  });

  // ── notify ──
  registerAction('notify', function (inst, scene, action) {
    if (typeof notify === 'function') notify(action.text);
    return 'done';
  });

  // ── chat: local-only message injection ──
  registerAction('chat', function (inst, scene, action) {
    try {
      if (typeof GameChat !== 'undefined' && GameChat._onMessage) {
        GameChat._onMessage({
          name: action.name || inst.script.name,
          text: action.text,
          level: action.level || 99,
          ts: Date.now(),
        });
      }
    } catch (e) { /* silently fail */ }
    return 'done';
  });

  // ── wait: pause N ms ──
  registerAction('wait', function (inst, scene, action, state) {
    if (!state._startTime) state._startTime = Date.now();
    return (Date.now() - state._startTime >= (action.ms || 1000)) ? 'done' : 'running';
  });

  // ── moveTo: move sprite toward target at px/sec ──
  registerAction('moveTo', function (inst, scene, action, state) {
    if (!state._targetX) {
      state._targetX = resolveCoord(action.x) * T;
      state._targetY = resolveCoord(action.y) * T;
      state._speed = action.speed || 60;
    }
    const sprite = inst.sprite;
    if (!sprite) return 'done';

    const dx = state._targetX - sprite.x;
    const dy = state._targetY - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 8) {
      sprite.x = state._targetX;
      sprite.y = state._targetY;
      return 'done';
    }

    const step = state._speed * 0.016; // assumes ~60fps
    const angle = Math.atan2(dy, dx);
    sprite.x += Math.cos(angle) * step;
    sprite.y += Math.sin(angle) * step;

    // Flip sprite based on movement direction
    if (sprite.setFlipX) sprite.setFlipX(dx < 0);

    return 'running';
  });

  // ── huntPlayer: persistent chase every frame ──
  registerAction('huntPlayer', function (inst, scene, action, state) {
    if (!scene.player || G.inBattle) return 'persistent';
    const sprite = inst.sprite;
    if (!sprite) return 'persistent';

    const px = scene.player.x, py = scene.player.y;
    const vx = sprite.x, vy = sprite.y;
    const dist = Phaser.Math.Distance.Between(vx, vy, px, py);
    const range = (action.aggroRange || 8) * T;

    if (dist < range && dist > 24) {
      const speed = (action.speed || 280) * 0.016;
      const angle = Math.atan2(py - vy, px - vx);
      sprite.x += Math.cos(angle) * speed;
      sprite.y += Math.sin(angle) * speed;
      if (sprite.setFlipX) sprite.setFlipX((px - vx) < 0);
    }
    return 'persistent';
  });

  // ── attackNPCs: persistent — destroy nearby NPCs on cooldown ──
  registerAction('attackNPCs', function (inst, scene, action, state) {
    if (!scene.npcSprites) return 'persistent';
    if (!state._cooldown) state._cooldown = 0;
    if (!state._killCount) state._killCount = 0;
    const now = Date.now();
    const cooldownMs = action.cooldownMs || 4000;

    if (now - state._cooldown < cooldownMs) return 'persistent';

    const sprite = inst.sprite;
    if (!sprite) return 'persistent';
    const radius = action.radius || 60;

    for (const npc of scene.npcSprites) {
      if (npc._eventDestroyed) continue;
      const d = Phaser.Math.Distance.Between(sprite.x, sprite.y, npc.x, npc.y);
      if (d < radius) {
        // Fire effect
        if (action.fx === 'fireball' || !action.fx) {
          const fire = scene.add.circle(npc.x, npc.y, 20, 0xff4400, 0.8).setDepth(15);
          scene.tweens.add({
            targets: fire, scaleX: 2, scaleY: 2, alpha: 0,
            duration: 600, onComplete: function () { fire.destroy(); },
          });
        }
        scene.cameras.main.shake(200, 0.003);

        // Hide NPC
        if (npc.sprite) npc.sprite.setVisible(false);
        if (npc.label) npc.label.setVisible(false);
        if (npc.marker) npc.marker.setVisible(false);
        if (npc._hint) { npc._hint.destroy(); npc._hint = null; }
        npc._eventDestroyed = true;

        state._killCount++;

        // Kill milestone comm
        const mult = action.onKillMultiple || 5;
        if (state._killCount % mult === 0 && action.onKillComm) {
          const kc = action.onKillComm;
          if (scene.comm) scene.comm.show(kc.speaker, kc.text, { color: kc.color, duration: kc.duration || 2500 });
        }

        // Schedule NPC respawn
        const respawnMs = action.respawnMs || 5 * 60 * 1000;
        scene.time.delayedCall(respawnMs, function () {
          if (npc.sprite) npc.sprite.setVisible(true);
          if (npc.label) npc.label.setVisible(true);
          if (npc.marker) npc.marker.setVisible(true);
          npc._eventDestroyed = false;
        });

        state._cooldown = now;
        break; // one per tick
      }
    }
    return 'persistent';
  });

  // ── battle: trigger BattleScene ──
  registerAction('battle', function (inst, scene, action, state) {
    console.log('[EventEngine] battle action fired, G.inBattle:', G.inBattle, 'team:', G.team?.length);
    if (G.inBattle) return 'done';
    G.inBattle = true;
    // Unfreeze player (battle scene takes over)
    if (scene.player) scene.player._eventFrozen = false;

    if (scene.player && scene.player.setVelocity) scene.player.setVelocity(0, 0);
    inst.paused = true;

    const battleCfg = inst.script.battle || {};
    const team = battleCfg.team || [];

    // Build enemy team
    var enemyGhosts = team.map(function (member) {
      var card = (typeof ALL_CARDS !== 'undefined' ? ALL_CARDS : []).find(function (c) { return c.id === member.cardId; }) || {};
      return {
        id: member.cardId, name: member.name, hp: member.hp, maxHp: member.hp,
        ko: false, ability: card.ability || '', abilityDesc: card.desc || '',
        rarity: card.rarity || 'legendary', usedOncePerGame: false, entryFired: false,
        _isEventBoss: true, _role: member.role,
      };
    });

    var playerGhosts = (typeof buildPlayerBattleTeam === 'function') ? buildPlayerBattleTeam() : [];
    var playerIds = playerGhosts.map(function (g) { return g.id; });
    var enemyIds = enemyGhosts.map(function (g) { return g.id; });

    try {
      if (typeof initBattle === 'function') {
        initBattle(playerIds, enemyIds, { type: battleCfg.type || 'event', isEventBattle: true });
        if (typeof B !== 'undefined' && B) {
          var eTeam = B.red ? B.blue : B.enemy;
          if (eTeam) {
            team.forEach(function (member, idx) {
              if (eTeam.ghosts[idx]) {
                eTeam.ghosts[idx].hp = member.hp;
                eTeam.ghosts[idx].maxHp = member.hp;
              }
            });
          }
        }
      }

      var sceneData = Object.assign({ trainerName: inst.script.name }, battleCfg.sceneData || {});

      scene.cameras.main.fadeOut(300, 0, 0, 0);
      scene.time.delayedCall(300, function () {
        scene.scene.launch('BattleScene', sceneData);
        scene.scene.pause();
      });
    } catch (err) {
      console.error('[EventEngine] Battle launch failed:', err);
      G.inBattle = false;
      inst.paused = false;
    }

    return 'done';
  });

  // ── giveReward: coins, xp, items, resources ──
  registerAction('giveReward', function (inst, scene, action) {
    if (action.coins && typeof G !== 'undefined') { G.coins = (G.coins || 0) + action.coins; }
    if (action.xp && typeof addXP === 'function') { addXP(action.xp); }
    if (action.resources) {
      for (var key in action.resources) {
        if (typeof G !== 'undefined' && G.hasOwnProperty(key)) {
          G[key] = (G[key] || 0) + action.resources[key];
        }
      }
    }
    if (action.items && Array.isArray(action.items)) {
      action.items.forEach(function (item) {
        if (typeof addItem === 'function') addItem(item);
      });
    }
    if (typeof saveGame === 'function') saveGame();
    if (typeof notify === 'function' && action.message) notify(action.message);
    return 'done';
  });

  // ── giveBuff ──
  registerAction('giveBuff', function (inst, scene, action) {
    if (typeof addBuff === 'function') {
      addBuff({
        id: action.id, name: action.name,
        effects: action.effects || {},
        durationMs: action.durationMs || 0,
        icon: action.icon, color: action.color,
        source: action.source || inst.script.name,
      });
    }
    return 'done';
  });

  // ── cameraShake ──
  registerAction('cameraShake', function (inst, scene, action) {
    if (scene && scene.cameras && scene.cameras.main) {
      scene.cameras.main.shake(action.duration || 300, action.intensity || 0.005);
    }
    return 'done';
  });

  // ── fadeOut ──
  registerAction('fadeOut', function (inst, scene, action, state) {
    if (!state._started) {
      state._started = true;
      state._doneTime = Date.now() + (action.ms || 300);
      if (scene && scene.cameras && scene.cameras.main) {
        scene.cameras.main.fadeOut(action.ms || 300, action.r || 0, action.g || 0, action.b || 0);
      }
    }
    return Date.now() >= state._doneTime ? 'done' : 'running';
  });

  // ── setFlag ──
  registerAction('setFlag', function (inst, scene, action) {
    if (typeof G !== 'undefined') {
      if (!G.eventFlags) G.eventFlags = {};
      G.eventFlags[action.key] = action.value !== undefined ? action.value : true;
      if (typeof saveGame === 'function') saveGame();
    }
    return 'done';
  });

  // ── checkFlag: conditional phase jump ──
  registerAction('checkFlag', function (inst, scene, action) {
    if (typeof G !== 'undefined' && G.eventFlags) {
      var val = G.eventFlags[action.key];
      var target = action.value !== undefined ? action.value : true;
      if (val === target && action.gotoPhase) {
        _jumpToPhase(inst, action.gotoPhase);
      }
    }
    return 'done';
  });

  // ── gotoPhase ──
  registerAction('gotoPhase', function (inst, scene, action) {
    _jumpToPhase(inst, action.phaseId);
    return 'done';
  });

  // ── endEvent ──
  registerAction('endEvent', function (inst, scene, action) {
    _cleanup(inst, scene);
    return 'done';
  });

  // ── playMusic ──
  registerAction('playMusic', function (inst, scene, action) {
    if (typeof Music !== 'undefined' && Music.play) Music.play(action.track);
    return 'done';
  });

  // ── sfx ──
  registerAction('sfx', function (inst, scene, action) {
    if (typeof SFX !== 'undefined' && SFX[action.name]) SFX[action.name]();
    return 'done';
  });

  // ── ambient: periodic random comm lines — persistent ──
  registerAction('ambient', function (inst, scene, action, state) {
    if (!state._lastTime) state._lastTime = Date.now();
    var interval = action.intervalMs || 15000;
    var lines = action.lines || [];
    if (lines.length === 0) return 'persistent';

    if (Date.now() - state._lastTime >= interval) {
      state._lastTime = Date.now();
      var text = lines[Math.floor(Math.random() * lines.length)];
      if (scene && scene.comm) {
        scene.comm.show(action.speaker || inst.script.name, text, {
          color: action.color, duration: action.duration || 3000,
        });
      }
    }
    return 'persistent';
  });

  // ══════════════════════════════════════════
  //  INSTANCE MANAGEMENT
  // ══════════════════════════════════════════

  function createSprite(script, scene) {
    var cfg = script.sprite || {};
    var sx = resolveCoord(script.spawnAt.x) * T;
    var sy = resolveCoord(script.spawnAt.y) * T;

    var key = cfg.key || 'npc_elder';
    if (cfg.fallbackKey && scene.textures && !scene.textures.exists(key)) {
      key = cfg.fallbackKey;
    }

    var sprite = scene.physics.add.sprite(sx, sy, key);
    sprite.setDepth(cfg.depth || 10);
    if (cfg.scale) sprite.setScale(cfg.scale);
    if (cfg.tint !== undefined) sprite.setTint(cfg.tint);

    // Labels
    var labels = [];
    if (cfg.labels && Array.isArray(cfg.labels)) {
      cfg.labels.forEach(function (lbl) {
        var txt = scene.add.text(sx, sy + (lbl.offsetY || -28), lbl.text, Object.assign({
          fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
        }, lbl.style || {}));
        txt.setOrigin(0.5).setDepth((cfg.depth || 10) + 1);
        labels.push({ obj: txt, offsetY: lbl.offsetY || -28 });
      });
    }

    return { sprite: sprite, labels: labels };
  }

  function updateLabels(inst) {
    if (!inst.sprite) return;
    var x = inst.sprite.x, y = inst.sprite.y;
    for (var i = 0; i < inst.labels.length; i++) {
      inst.labels[i].obj.setPosition(x, y + inst.labels[i].offsetY);
    }
  }

  function _jumpToPhase(inst, phaseId) {
    var phases = inst.script.phases || [];
    for (var i = 0; i < phases.length; i++) {
      if (phases[i].id === phaseId) {
        inst.phaseIdx = i;
        inst.actionIdx = 0;
        inst.actionState = {};
        inst.persistent = [];
        return;
      }
    }
    console.warn('[EventEngine] Phase not found:', phaseId);
  }

  function _cleanup(inst, scene) {
    if (inst._cleaned) return;
    inst._cleaned = true;

    if (inst.sprite) { inst.sprite.destroy(); inst.sprite = null; }
    for (var i = 0; i < inst.labels.length; i++) {
      inst.labels[i].obj.destroy();
    }
    inst.labels = [];
    inst.persistent = [];
    inst.active = false;
    _active.delete(inst.script.id);
  }

  function _expire(inst, scene) {
    var script = inst.script;
    if (script.onExpire) {
      var exp = script.onExpire;
      if (exp.comm && scene && scene.comm) {
        scene.comm.show(exp.comm.speaker || script.name, exp.comm.text, {
          color: exp.comm.color, duration: exp.comm.duration || 3000,
        });
      }
      if (exp.notify && typeof notify === 'function') notify(exp.notify);
    }
    _cleanup(inst, scene);
  }

  // ══════════════════════════════════════════
  //  COLLISION DETECTION
  // ══════════════════════════════════════════

  function checkCollisions(inst, scene) {
    var trigger = inst.script.collisionTrigger;
    if (!trigger || !inst.sprite || G.inBattle) return;

    if (trigger.target === 'player' && scene.player) {
      var dist = Phaser.Math.Distance.Between(
        inst.sprite.x, inst.sprite.y,
        scene.player.x, scene.player.y
      );
      if (dist < (trigger.radius || 40)) {
        // Prevent double-triggering
        if (inst._collisionFired) return;
        inst._collisionFired = true;

        if (trigger.phase) {
          // Transition to a named phase (freeze→talk→battle flow)
          console.log('[EventEngine] Collision! Jumping to phase:', trigger.phase, 'for', inst.script.id);
          _jumpToPhase(inst, trigger.phase);
        } else if (trigger.type === 'battle') {
          // Direct battle
          var executor = _executors['battle'];
          if (executor) executor(inst, scene, {}, {});
        } else if (trigger.type === 'dialogue') {
          var executor2 = _executors[trigger.actionType || 'comm'];
          if (executor2) executor2(inst, scene, trigger, {});
        } else if (trigger.type === 'endEvent') {
          _cleanup(inst, scene);
        }
      }
    }
  }

  // ══════════════════════════════════════════
  //  PHASE / ACTION ADVANCEMENT
  // ══════════════════════════════════════════

  function advanceActions(inst, scene) {
    try {
    var phases = inst.script.phases || [];
    if (inst.phaseIdx >= phases.length) {
      _cleanup(inst, scene);
      return;
    }

    var phase = phases[inst.phaseIdx];
    var actions = phase.actions || [];

    // Process sequential actions
    while (inst.actionIdx < actions.length) {
      var action = actions[inst.actionIdx];
      var executor = _executors[action.type];
      if (!executor) {
        console.warn('[EventEngine] Unknown action type:', action.type);
        inst.actionIdx++;
        continue;
      }

      // Initialize action state if needed
      if (!inst.actionState[inst.actionIdx]) {
        inst.actionState[inst.actionIdx] = {};
      }
      var state = inst.actionState[inst.actionIdx];

      var result = executor(inst, scene, action, state);

      if (result === 'persistent') {
        // Add to persistent list and move to next action
        inst.persistent.push({ executor: executor, action: action, state: state });
        inst.actionIdx++;
        continue;
      }

      if (result === 'running') {
        // Still processing — stop advancing this frame
        return;
      }

      // result === 'done' — advance to next action
      inst.actionIdx++;
    }

    // All actions in phase exhausted
    // If there are persistent actions, phase stays active
    if (inst.persistent.length > 0) return;

    // Otherwise, advance to next phase
    inst.phaseIdx++;
    inst.actionIdx = 0;
    inst.actionState = {};
    inst.persistent = [];

    // Check if we've passed all phases
    if (inst.phaseIdx >= phases.length) {
      _cleanup(inst, scene);
    }
    } catch(e) { console.error('[EventEngine] advanceActions error:', e, 'event:', inst.script?.id, 'phase:', inst.phaseIdx, 'action:', inst.actionIdx); }
  }

  // ══════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════

  window.EventEngine = {

    /** Start an event. Returns the event id or null if blocked. */
    start: function (script, scene) {
      if (!script || !script.id || !scene) {
        console.warn('[EventEngine] Invalid script or scene');
        return null;
      }

      // Singleton check
      if (script.singleton && _active.has(script.id)) {
        return null;
      }

      // Create sprite
      var created = createSprite(script, scene);

      var inst = {
        script: script,
        sprite: created.sprite,
        labels: created.labels,
        phaseIdx: 0,
        actionIdx: 0,
        actionState: {},
        persistent: [],
        startedAt: Date.now(),
        expiresAt: script.expiresAfterMs ? Date.now() + script.expiresAfterMs : 0,
        paused: false,
        active: true,
        _cleaned: false,
      };

      _active.set(script.id, inst);

      // Also store on scene for backwards compat with Valkin checks
      if (script.id === 'valkin_the_grand') {
        scene._valkinEvent = { active: true, sprite: inst.sprite, _engineManaged: true };
      }

      return script.id;
    },

    /** Main update — call once per frame from WorldScene.update() */
    update: function (scene) {
      _active.forEach(function (inst, id) {
        try {
        if (inst.paused || inst._cleaned) return;

        // Check expiry
        if (inst.expiresAt && Date.now() > inst.expiresAt) {
          _expire(inst, scene);
          return;
        }

        // Check collision triggers
        checkCollisions(inst, scene);
        if (inst._cleaned) return;

        // Tick persistent actions
        for (var i = 0; i < inst.persistent.length; i++) {
          var pa = inst.persistent[i];
          pa.executor(inst, scene, pa.action, pa.state);
        }

        // Advance sequential actions
        advanceActions(inst, scene);

        // Update label positions
        updateLabels(inst);
        } catch(e) { console.error('[EventEngine] update error for', inst.script?.id, ':', e); _cleanup(inst, scene); }
      });
    },

    /** Pause a specific event */
    pause: function (eventId) {
      var inst = _active.get(eventId);
      if (inst) inst.paused = true;
    },

    /** Resume a specific event */
    resume: function (eventId) {
      var inst = _active.get(eventId);
      if (inst) inst.paused = false;
    },

    /** Force-end an event with cleanup */
    end: function (eventId, scene) {
      var inst = _active.get(eventId);
      if (inst) _cleanup(inst, scene || null);
    },

    /** Check if an event is active */
    isActive: function (eventId) {
      return _active.has(eventId);
    },

    /** Get instance (for external queries) */
    getInstance: function (eventId) {
      return _active.get(eventId) || null;
    },

    /** Register a custom action type */
    registerAction: registerAction,

    /** All active event IDs */
    activeIds: function () {
      return Array.from(_active.keys());
    },
  };

})();
