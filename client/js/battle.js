/**
 * Battle Arena Coordinator for sticky-fight
 * Manages game loops, collision systems, canvas rendering, particles and keyboard/touch inputs.
 * Supports jumping, 3-phase attack logic, hit-stops, motion trails, dust particles,
 * and critical shatters.
 */

class BattleManager {
  constructor() {
    this.canvas = document.getElementById('battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Core game parameters
    this.active = false;
    this.gameMode = 'single'; // 'single' or 'multi'
    this.localPlayerId = null;

    // Characters objects
    this.p1 = null; // Left player / Client
    this.p2 = null; // Right player / Bot / Opponent

    // Single Player specific
    this.botAI = null;
    this.roundWinner = null;
    this.score = { p1: 0, p2: 0 };
    this.roundsCount = 0;
    this.difficulty = 'easy';

    // Particle registers
    this.particles = [];
    this.dustParticles = [];

    // Screen effects
    this.cameraShakeTime = 0;
    this.cameraShakeMagnitude = 0;
    this.hitStopTimer = 0; // Game freeze frame timer

    // Key states
    this.keys = {
      left: false,
      right: false,
      up: false,
      attack: false,
      block: false
    };

    // Countdown and clock
    this.roundTimeLimit = 120000; // 2 minutes in ms
    this.roundStartTime = 0;
    this.isCountdownActive = false;

    // Special Mock Sequence (Final Round Atom Bomb)
    this.mockSequenceActive = false;
    this.mockLoser = null;
    this.airplane = null;
    this.bomb = null;
    this.screenFlashTime = 0;
    this.countdownText = '';
    
    this.initInputListeners();
  }

  /**
   * Binds keydown, keyup and virtual mobile touch actions.
   */
  initInputListeners() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;

      const k = e.code;
      if (k === 'KeyA' || k === 'ArrowLeft') this.keys.left = true;
      if (k === 'KeyD' || k === 'ArrowRight') this.keys.right = true;
      if (k === 'KeyS' || k === 'ShiftLeft' || k === 'ShiftRight') this.keys.block = true;
      if (k === 'KeyW' || k === 'ArrowUp') this.keys.up = true;
      
      // Attack is an instant trigger on Space only (W/ArrowUp are for jump)
      if (k === 'Space' && !this.keys.attack) {
        this.keys.attack = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.active) return;

      const k = e.code;
      if (k === 'KeyA' || k === 'ArrowLeft') this.keys.left = false;
      if (k === 'KeyD' || k === 'ArrowRight') this.keys.right = false;
      if (k === 'KeyS' || k === 'ShiftLeft' || k === 'ShiftRight') this.keys.block = false;
      if (k === 'KeyW' || k === 'ArrowUp') this.keys.up = false;
      if (k === 'Space') this.keys.attack = false;
    });

    // Mobile Virtual Touch Controls
    const mbtnLeft = document.getElementById('mbtn-left');
    const mbtnRight = document.getElementById('mbtn-right');
    const mbtnBlock = document.getElementById('mbtn-block');
    const mbtnJump = document.getElementById('mbtn-jump');
    const mbtnAttack = document.getElementById('mbtn-attack');

    if (mbtnLeft) {
      const startLeft = (e) => { e.preventDefault(); this.keys.left = true; };
      const endLeft = (e) => { e.preventDefault(); this.keys.left = false; };
      mbtnLeft.addEventListener('mousedown', startLeft);
      mbtnLeft.addEventListener('mouseup', endLeft);
      mbtnLeft.addEventListener('touchstart', startLeft);
      mbtnLeft.addEventListener('touchend', endLeft);
    }

    if (mbtnRight) {
      const startRight = (e) => { e.preventDefault(); this.keys.right = true; };
      const endRight = (e) => { e.preventDefault(); this.keys.right = false; };
      mbtnRight.addEventListener('mousedown', startRight);
      mbtnRight.addEventListener('mouseup', endRight);
      mbtnRight.addEventListener('touchstart', startRight);
      mbtnRight.addEventListener('touchend', endRight);
    }

    if (mbtnBlock) {
      const startBlock = (e) => { e.preventDefault(); this.keys.block = true; };
      const endBlock = (e) => { e.preventDefault(); this.keys.block = false; };
      mbtnBlock.addEventListener('mousedown', startBlock);
      mbtnBlock.addEventListener('mouseup', endBlock);
      mbtnBlock.addEventListener('touchstart', startBlock);
      mbtnBlock.addEventListener('touchend', endBlock);
    }

    if (mbtnJump) {
      const startJump = (e) => { e.preventDefault(); this.keys.up = true; };
      const endJump = (e) => { e.preventDefault(); this.keys.up = false; };
      mbtnJump.addEventListener('mousedown', startJump);
      mbtnJump.addEventListener('mouseup', endJump);
      mbtnJump.addEventListener('touchstart', startJump);
      mbtnJump.addEventListener('touchend', endJump);
    }

    if (mbtnAttack) {
      const startAttack = (e) => { e.preventDefault(); this.keys.attack = true; };
      const endAttack = (e) => { e.preventDefault(); if (this.keys.attack) this.keys.attack = false; };
      mbtnAttack.addEventListener('mousedown', startAttack);
      mbtnAttack.addEventListener('mouseup', endAttack);
      mbtnAttack.addEventListener('touchstart', startAttack);
      mbtnAttack.addEventListener('touchend', endAttack);
    }
  }

  /**
   * Initializes a new match against an AI bot.
   */
  startSinglePlayerMatch(playerColor, difficulty, nickname) {
    this.gameMode = 'single';
    this.difficulty = difficulty;
    this.score = { p1: 0, p2: 0 };
    this.roundsCount = 0;
    this.active = true;
    this.particles = [];
    this.dustParticles = [];
    this.hitStopTimer = 0;
    
    // Configure HUD labels
    document.getElementById('hud-p1-name').textContent = nickname;
    document.getElementById('hud-p2-name').textContent = `Bot (${difficulty.toUpperCase()})`;
    document.getElementById('ping-indicator').classList.add('hidden');
    window.ui.updateRoundScores(0, 0);

    // Pick a random remaining color for the Bot
    const colors = ['green', 'yellow', 'blue', 'red'];
    const remainingColors = colors.filter(c => c !== playerColor);
    const botColor = remainingColors[Math.floor(Math.random() * remainingColors.length)];

    // Initialize characters
    this.p1 = new window.Stickman(playerColor, true);
    this.p2 = new window.Stickman(botColor, false);
    
    // Set HP and maxHp
    this.p1.maxHp = playerColor === 'green' ? 115 : 100;
    this.p2.maxHp = botColor === 'green' ? 115 : 100;

    // Reset trail histories
    this.p1.trailHistory = [];
    this.p2.trailHistory = [];

    // AI configuration
    this.botAI = new window.BotAI(difficulty, botColor);

    this.startRound();
    this.runAnimationLoop();
  }

  /**
   * Begins a new round.
   */
  startRound() {
    this.p1.resetState();
    this.p2.resetState();

    this.mockSequenceActive = false;
    this.mockLoser = null;
    this.airplane = null;
    this.bomb = null;
    this.screenFlashTime = 0;

    this.p1.hp = this.p1.maxHp;
    this.p2.hp = this.p2.maxHp;

    this.p1.x = 200;
    this.p1.y = 400;
    this.p1.vy = 0;
    this.p1.direction = 1;

    this.p2.x = 600;
    this.p2.y = 400;
    this.p2.vy = 0;
    this.p2.direction = -1;

    window.ui.updateHpBar(1, this.p1.hp, this.p1.maxHp);
    window.ui.updateHpBar(2, this.p2.hp, this.p2.maxHp);

    if (this.botAI) this.botAI.reset();

    // Trigger visual countdown
    this.isCountdownActive = true;
    let count = 3;
    this.countdownText = count.toString();
    window.audio.playTone(400, 'triangle', 0.08, 0.1);

    const announce = document.getElementById('battle-announcement');
    announce.textContent = this.countdownText;
    announce.classList.remove('hidden');

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownText = count.toString();
        announce.textContent = this.countdownText;
        window.audio.playTone(400, 'triangle', 0.08, 0.1);
      } else if (count === 0) {
        this.countdownText = 'JANG!'; // FIGHT!
        announce.textContent = this.countdownText;
        window.audio.playTone(880, 'sine', 0.25, 0.15);
        this.isCountdownActive = false;
        this.roundStartTime = Date.now();
        
        setTimeout(() => {
          announce.classList.add('hidden');
        }, 1000);
        
        clearInterval(interval);
      }
    }, 1000);
  }

  /**
   * Initializes multiplayer settings from server configurations.
   */
  initMultiplayerMatch(room, localSocketId) {
    this.gameMode = 'multi';
    this.active = true;
    this.particles = [];
    this.dustParticles = [];
    this.hitStopTimer = 0;
    this.localPlayerId = localSocketId;

    const p1Data = room.players.find(p => p.role === 'player1');
    const p2Data = room.players.find(p => p.role === 'player2');

    const isP1 = p1Data.id === localSocketId;

    // HUD Names setup
    document.getElementById('hud-p1-name').textContent = isP1 ? `${p1Data.nickname} (Siz)` : p1Data.nickname;
    document.getElementById('hud-p2-name').textContent = isP1 ? p2Data.nickname : `${p2Data.nickname} (Siz)`;

    // Create render entities
    this.p1 = new window.Stickman(p1Data.heroColor, true);
    this.p1.id = p1Data.id;
    this.p1.maxHp = p1Data.maxHp;
    this.p1.trailHistory = [];

    this.p2 = new window.Stickman(p2Data.heroColor, false);
    this.p2.id = p2Data.id;
    this.p2.maxHp = p2Data.maxHp;
    this.p2.trailHistory = [];

    this.runAnimationLoop();
  }

  /**
   * Synchronizes server data ticks in multiplayer mode.
   */
  syncMultiplayerStates(playersData) {
    if (!this.p1 || !this.p2) return;

    playersData.forEach(p => {
      const stickman = this.p1.id === p.id ? this.p1 : this.p2;
      
      // Select appropriate HUD update side (Siz is always left in our UI HUD)
      const isLocal = p.id === this.localPlayerId;
      const playerNum = isLocal ? 1 : 2;

      // Detect knockdown transitions on client
      if (p.action === 'knockdown' && stickman.action !== 'knockdown') {
        this.spawnDust(p.x, 400, 0, 16); // Kick up floor dust explosion
      }

      // Update character registers
      stickman.update(p.x, p.y, p.hp, p.action, p.direction, p.actionTimer);
      
      // Update HUD Health bars
      window.ui.updateHpBar(playerNum, p.hp, stickman.maxHp);
    });
  }

  /**
   * Main client loop coordinating render cycles and local physics updates (Single Player).
   */
  runAnimationLoop(timestamp) {
    if (!this.active) return;

    const now = timestamp || performance.now();
    const dt = now - (this.lastTime || now);
    this.lastTime = now;

    // 1. Process client physics or transmission
    if (this.hitStopTimer > 0) {
      // Hit-stop freeze frame: pause physics updates but keep animating particles/camera shake
      this.hitStopTimer -= 16.67;
    } else {
      if (this.gameMode === 'single') {
        this.updateSinglePlayerPhysics(now);
      } else {
        // In multiplayer, gather local inputs and transmit to server
        const inputStates = {
          left: this.keys.left,
          right: this.keys.right,
          up: this.keys.up,
          attack: this.keys.attack,
          block: this.keys.block
        };
        window.network.sendInputs(inputStates);
        
        // Clear attack trigger quickly after sending
        if (this.keys.attack) {
          this.keys.attack = false;
        }

        // Decrement actionTimer locally on both players for smooth client animations between server ticks
        const localDt = Math.min(100, dt);
        if (this.p1 && this.p1.actionTimer > 0) {
          this.p1.actionTimer -= localDt;
          if (this.p1.actionTimer <= 0) {
            this.p1.actionTimer = 0;
            this.p1.action = 'idle';
          }
        }
        if (this.p2 && this.p2.actionTimer > 0) {
          this.p2.actionTimer -= localDt;
          if (this.p2.actionTimer <= 0) {
            this.p2.actionTimer = 0;
            this.p2.action = 'idle';
          }
        }
      }
    }

    // Update trails histories
    this.updateSwordTrails();

    // 2. Render graphics frame
    this.renderFrame(now);

    requestAnimationFrame((t) => this.runAnimationLoop(t));
  }

  /**
   * Single Player physics engine loop.
   */
  updateSinglePlayerPhysics(time) {
    if (this.isCountdownActive || this.p1.hp <= 0 || this.p2.hp <= 0) return;

    // A. Update round timer clock display
    const elapsed = Date.now() - this.roundStartTime;
    const remaining = Math.max(0, this.roundTimeLimit - elapsed);
    
    const minutes = Math.floor(remaining / 60000).toString().padStart(2, '0');
    const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    document.getElementById('battle-timer').textContent = `${minutes}:${seconds}`;

    if (remaining <= 0) {
      // Time over - Draw
      this.handleRoundFinish('draw');
      return;
    }

    // B. AI Logic Call (Include vertical jump checks inside AI update inputs)
    // To make Bot jump occasionally, botAI profile checks:
    const botInputs = this.botAI.update(this.p2, this.p1, time);
    if (this.difficulty === 'hard' && Math.random() < 0.008 && this.p2.y === 400) {
      botInputs.up = true;
    }

    // C. Process physical coordinate updates
    this.applyPlayerControls(this.p1, this.p2, this.keys, time);
    this.applyPlayerControls(this.p2, this.p1, botInputs, time);

    // D. Sword collision validations
    this.validateSwordHits(this.p1, this.p2, 1, time);
    this.validateSwordHits(this.p2, this.p1, 2, time);

    // E. Check for round end conditions
    if (this.p1.hp <= 0 && this.p2.hp <= 0) {
      this.handleRoundFinish('draw');
    } else if (this.p1.hp <= 0) {
      this.handleRoundFinish('p2');
    } else if (this.p2.hp <= 0) {
      this.handleRoundFinish('p1');
    }
  }

  /**
   * Updates coordinates, animations and clamps to boundaries.
   */
  applyPlayerControls(player, opponent, inputs, time) {
    // Decrease locked animation action timers
    if (player.actionTimer > 0) {
      player.actionTimer -= 16.67; // approx ms per frame
      if (player.actionTimer <= 0) {
        player.actionTimer = 0;
        player.action = 'idle';
      }
    }

    // Vertical gravity physics
    if (player.y === undefined) player.y = 400;
    if (player.vy === undefined) player.vy = 0;

    if (player.y < 400) {
      player.vy += 0.5; // gravity
      player.y += player.vy;
      
      if (player.y >= 400) {
        player.y = 400;
        player.vy = 0;
        // Landing dust particles
        this.spawnDust(player.x, 400, 0, 6);
        window.audio.playTone(180, 'triangle', 0.06, 0.06);
      }
    } else if (inputs.up && player.action !== 'knockdown' && player.action !== 'hit_reaction') {
      player.vy = -11; // vertical jump impulse
      player.y += player.vy;
      this.spawnDust(player.x, 400, 0, 3); // Kick off dust
      window.audio.playTone(300, 'triangle', 0.05, 0.05);
      inputs.up = false; // Reset instant trigger
    }

    // Apply speed modifiers
    let speed = 4;
    if (player.color === 'yellow') speed = 4.8; // +20% Yellow speed bonus
    
    if (player.action === 'block') speed = 1.0; // slowed while blocking

    const isLocked = ['attack', 'hit_reaction', 'knockdown', 'death'].includes(player.action);

    if (!isLocked) {
      let moving = false;
      let dx = 0;

      if (inputs.left) {
        dx -= speed;
        moving = true;
      }
      if (inputs.right) {
        dx += speed;
        moving = true;
      }

      player.x += dx;

      // Orient facing direction towards opponent
      player.direction = player.x < opponent.x ? 1 : -1;

      if (moving) {
        // Walk direction relative to opponent orientation
        const movingForward = (dx > 0 && player.direction === 1) || (dx < 0 && player.direction === -1);
        player.action = movingForward ? 'move_forward' : 'move_back';

        // Emit footstep dust periodically
        if (player.y === 400 && Math.random() < 0.15) {
          this.spawnDust(player.x, 400, -player.direction * 0.4, 1);
        }
      } else {
        if (inputs.block) {
          player.action = 'block';
        } else {
          player.action = 'idle';
        }
      }

      // If in the air and not blocking, force jump pose
      if (player.y < 400 && player.action !== 'block') {
        player.action = 'jump';
      }
    }

    // Override with block action if not locked
    if (!isLocked && inputs.block) {
      player.action = 'block';
    }

    // Attack triggers (cooldown is checked inside action locks)
    if (!isLocked && inputs.attack && (!player.attackCooldown || time > player.attackCooldown)) {
      player.action = 'attack';
      const attackDuration = player.color === 'red' ? 380 : 450;
      player.actionTimer = attackDuration;
      player.maxActionTimer = attackDuration;
      player.attackCooldown = time + attackDuration + 150; // duration + cooldown block
      player.hasStruck = false;
      
      // Synthesize swish sound
      window.audio.playSwish();

      // Reset keyboard attack trigger instantly
      inputs.attack = false;
    }

    // Clamp coordinates to screen width boundary
    if (player.x < 50) player.x = 50;
    if (player.x > 750) player.x = 750;
  }

  /**
   * Sword collision detection (Single Player).
   */
  validateSwordHits(attacker, target, attackerNum, time) {
    if (attacker.action !== 'attack' || attacker.hasStruck) return;
    if (target.action === 'death' || target.action === 'knockdown') return;

    // Hit registration timing: trigger at the start of the Strike phase (Windup is first 40%)
    const progress = 1 - (attacker.actionTimer / attacker.maxActionTimer);
    if (progress < 0.40) return;

    const distance = Math.abs(attacker.x - target.x);
    
    // Add vertical reach tolerance of 80px for aerial fights
    const verticalDiff = Math.abs(attacker.y - target.y);
    const swordReach = 105; // body offset + wood sword length

    const isFacingTarget = (attacker.x < target.x && attacker.direction === 1) || 
                           (attacker.x > target.x && attacker.direction === -1);

    if (distance <= swordReach && verticalDiff <= 80 && isFacingTarget) {
      // Hit connects!
      attacker.hasStruck = true;

      const targetIsBlocking = target.action === 'block';
      let baseDamage = Math.floor(5 + Math.random() * 8); // 5 to 12%
      let damage = baseDamage;
      let isBlocked = false;

      if (targetIsBlocking) {
        isBlocked = true;
        const blockReduction = target.color === 'blue' ? 0.90 : 0.75;
        damage = Math.max(1, Math.round(baseDamage * (1 - blockReduction)));
      }

      // Combo System: hit must connect within 1.5s of the previous hit
      let isComboBonus = false;
      if (time - attacker.lastHitTime < 1500) {
        attacker.combo++;
        if (attacker.combo >= 3) {
          damage += 5; // combo bonus damage
          attacker.combo = 0; // reset
          isComboBonus = true;
        }
      } else {
        attacker.combo = 1;
      }
      attacker.lastHitTime = time;

      // Update combo displays
      window.ui.triggerComboIndicator(attackerNum, attacker.combo);
      if (isComboBonus) window.ui.showToast('Combo bonus! +5 zarar');

      // Apply damage
      target.hp = Math.max(0, target.hp - damage);
      const targetNum = attackerNum === 1 ? 2 : 1;
      window.ui.updateHpBar(targetNum, target.hp, target.maxHp);

      // Hit-stop freeze frame (60ms)
      this.hitStopTimer = 60;

      // Knockdown triggers check: damage >= 10 OR HP < 20%
      const triggerKnockdown = (damage >= 10 || target.hp < 20) && target.hp > 0;

      if (triggerKnockdown) {
        target.action = 'knockdown';
        target.actionTimer = 1500; // Locked duration
        target.vy = -5; // fly back slightly
        target.y += target.vy;
        target.x += attacker.direction * 50; // Larger knockback

        // Play heavy impact sound
        window.audio.playTone(100, 'sawtooth', 0.2, 0.2);
        this.applyCameraShake(12); // Heavy shake
        this.spawnSparks((attacker.x + target.x)/2, (attacker.y + target.y)/2 - 30, '#ff3366');
        
        // Spawn knockdown floor dust explosion
        this.spawnDust(target.x, 400, 0, 16);
      } else if (!targetIsBlocking) {
        target.action = 'hit_reaction';
        target.actionTimer = 220; // Recoil lock duration
        target.x += attacker.direction * 35; // knockback
        
        window.audio.playHit();
        this.applyCameraShake(8);
        this.spawnSparks((attacker.x + target.x)/2, (attacker.y + target.y)/2 - 30, '#ff3366'); // red hit sparks
      } else {
        target.x += attacker.direction * 10; // small push back on block
        
        // Trigger block recoil shake on target
        target.blockRecoilTime = 8;

        window.audio.playBlock();
        this.applyCameraShake(3);
        this.spawnSparks((attacker.x + target.x)/2, (attacker.y + target.y)/2 - 30, '#ffcc00'); // yellow block clink sparks
      }

      // Clamp target after pushback
      if (target.x < 50) target.x = 50;
      if (target.x > 750) target.x = 750;
    }
  }

  /**
   * Tracks sword tip positions during slashes to construct trails.
   */
  updateSwordTrails() {
    [this.p1, this.p2].forEach(p => {
      if (!p) return;
      p.trailHistory = p.trailHistory || [];

      const progress = p.action === 'attack' ? (1 - (p.actionTimer / p.maxActionTimer)) : 0;
      const isStrikePhase = p.action === 'attack' && progress >= 0.40 && progress <= 0.65;

      if (isStrikePhase && p.swordTipX !== undefined) {
        p.trailHistory.push({ x: p.swordTipX, y: p.swordTipY });
        if (p.trailHistory.length > 6) {
          p.trailHistory.shift();
        }
      } else {
        // Slowly clear trail history
        if (p.trailHistory.length > 0) {
          p.trailHistory.shift();
        }
      }
    });
  }

  /**
   * Spawns wood splinters or blood sparks particles.
   */
  spawnSparks(x, y, color) {
    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slightly upward gravity offset
        color,
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  }

  /**
   * Spawns grey smoke dust particles at coordinate.
   */
  spawnDust(x, y, vxOffset, count = 2) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * (Math.PI / 2); // mostly upward
      const speed = 0.5 + Math.random() * 1.5;
      this.dustParticles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y - 2,
        vx: Math.cos(angle) * speed + vxOffset,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        alpha: 0.4,
        decay: 0.015 + Math.random() * 0.015
      });
    }
  }

  /**
   * Spawns massive explosion sparks (orange/red/yellow) and thick smoke clouds.
   */
  spawnExplosionSparks(x, y) {
    // 1. Spawning tons of fire sparks
    const colors = ['#ff3300', '#ff6600', '#ffcc00', '#ffffff'];
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        alpha: 1.0,
        decay: 0.01 + Math.random() * 0.02
      });
    }

    // 2. Spawning thick black/grey smoke clouds
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.dustParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 10 + Math.random() * 15,
        alpha: 0.7,
        decay: 0.008 + Math.random() * 0.01
      });
    }
  }

  /**
   * Draws a military plane silhouette flying from left to right.
   */
  drawAirplane(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#4b5563'; // dark military grey
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;

    ctx.beginPath();
    // Fuselage
    ctx.moveTo(x - 50, y);
    ctx.lineTo(x + 40, y);
    ctx.quadraticCurveTo(x + 55, y, x + 60, y + 5); // nose cone
    ctx.quadraticCurveTo(x + 55, y + 10, x + 40, y + 10);
    ctx.lineTo(x - 45, y + 10);
    ctx.lineTo(x - 50, y + 15); // tail bottom
    ctx.lineTo(x - 55, y + 15);
    ctx.lineTo(x - 52, y - 10); // tail fin top
    ctx.lineTo(x - 45, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Main Wing (behind/below)
    ctx.fillStyle = '#374151'; // darker color for wing
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 5);
    ctx.lineTo(x - 10, y + 30);
    ctx.lineTo(x - 25, y + 30);
    ctx.lineTo(x - 5, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Main Wing (front/above)
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 5);
    ctx.lineTo(x - 15, y - 25);
    ctx.lineTo(x - 28, y - 25);
    ctx.lineTo(x - 5, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jet engine glow (small red/orange particle circles behind the plane tail)
    if (Math.random() < 0.7) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // orange-red jet flame
      ctx.beginPath();
      ctx.arc(x - 58, y + 5, 4 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draws a teardrop atomic bomb design.
   */
  drawAtomicBomb(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#1f2937'; // very dark grey/black
    ctx.strokeStyle = '#ef4444'; // glowing red lines on the bomb for style!
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;

    // Body (classic oval / teardrop fat bomb)
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2); // basic shape
    ctx.fill();
    ctx.stroke();

    // Fin structure at the top (tail fins)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - 8, y - 18, 16, 4); // tail cap
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 10);
    ctx.lineTo(x - 8, y - 18);
    ctx.lineTo(x + 8, y - 18);
    ctx.lineTo(x + 4, y - 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Animates active canvas particles.
   */
  updateParticles() {
    // Normal sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // apply gravity
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Dust particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95; // friction
      p.vy *= 0.95;
      p.size += 0.15; // expand
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.dustParticles.splice(i, 1);
      }
    }
  }

  /**
   * Triggers camera shake variables.
   */
  applyCameraShake(magnitude) {
    this.cameraShakeMagnitude = magnitude;
    this.cameraShakeTime = 15; // frames count
  }

  /**
   * Processes round finish overlays (Single Player).
   */
  handleRoundFinish(winnerRole) {
    this.isCountdownActive = true; // lock movements
    
    let announceText = 'DURANG!';
    let loser = null;
    
    if (winnerRole === 'p1') {
      this.score.p1++;
      announceText = 'Siz Yutdingiz!';
      loser = this.p2;
    } else if (winnerRole === 'p2') {
      this.score.p2++;
      announceText = 'Mag\'lubiyat!';
      loser = this.p1;
    } else {
      // Draw: both collapse
      loser = Math.random() < 0.5 ? this.p1 : this.p2;
    }

    // Determine defeat animation style (Variant A vs Variant C)
    // 30% chance or if combo hit finishes the round, trigger Critical Shatter deconstruction
    const isCriticalFinish = loser && (loser.combo >= 2 || Math.random() < 0.35);
    const isFinalRound = this.score.p1 === 2 || this.score.p2 === 2;

    if (isFinalRound && loser) {
      this.mockSequenceActive = true;
      this.mockLoser = loser;
      
      // Force loser to lay flat on the ground
      loser.action = 'knockdown';
      loser.actionTimer = 900;
      loser.maxActionTimer = 1500;

      // Jets motor rumble sound synthesis
      window.audio.playTone(130, 'triangle', 0.25, 2.5);
      setTimeout(() => {
        if (this.mockSequenceActive) window.audio.playTone(180, 'triangle', 0.2, 2.0);
      }, 1000);

      this.airplane = {
        x: -100,
        y: 80,
        vx: 4.5,
        targetX: loser.x,
        bombDropped: false
      };
      this.bomb = null;
      this.screenFlashTime = 0;
    } else if (loser) {
      if (isCriticalFinish) {
        loser.action = 'shatter';
        loser.isShattered = false;
        loser.shatteredParts = [];
        
        // Massive shatter spark explosion
        this.spawnSparks(loser.x, loser.y - 30, loser.boneColor);
        window.audio.playTone(80, 'sawtooth', 0.4, 0.3); // Heavy crash sound
      } else {
        // Standard knee collapse (Variant A)
        loser.action = 'death';
        loser.actionTimer = 1000;
        loser.maxActionTimer = 1000;
      }
    }

    const announce = document.getElementById('battle-announcement');
    announce.textContent = announceText;
    announce.classList.remove('hidden');

    window.ui.updateRoundScores(this.score.p1, this.score.p2);
    window.audio.playTone(523.25, 'sine', 0.4, 0.15); // End round chime

    // Check match completion (Best of 3)
    if (isFinalRound) {
      setTimeout(() => {
        this.endMatch();
        this.showFinalResult();
        this.mockSequenceActive = false;
        this.mockLoser = null;
        this.airplane = null;
        this.bomb = null;
      }, 5500);
    } else {
      // Start next round after 3 seconds
      setTimeout(() => {
        announce.classList.add('hidden');
        this.startRound();
      }, 3000);
    }
  }

  /**
   * Resets active rendering loops.
   */
  endMatch() {
    this.active = false;
    this.p1 = null;
    this.p2 = null;
    this.botAI = null;
  }

  /**
   * Renders the final result screen (Single Player).
   */
  showFinalResult() {
    const title = document.getElementById('result-title');
    const desc = document.getElementById('result-desc');
    const scoreVal = document.getElementById('res-score-vals');
    const p1Label = document.getElementById('res-p1-name');
    const p2Label = document.getElementById('res-p2-name');

    const isWinner = this.score.p1 === 2;

    title.textContent = isWinner ? "Siz G'alaba Qozondingiz!" : "Siz Mag'lub Bo'ldingiz...";
    title.style.color = isWinner ? "var(--color-green)" : "var(--color-red)";
    desc.textContent = `Bot ustidan ${this.difficulty} qiyinlik rejimida jang yakunlandi.`;
    
    p1Label.textContent = "Siz";
    p2Label.textContent = "Bot";
    scoreVal.textContent = `${this.score.p1} - ${this.score.p2}`;

    if (isWinner) {
      window.audio.playVictory();
    } else {
      window.audio.playDefeat();
    }

    window.ui.showScreen('screen-result');
  }

  /**
   * Canvas frame rendering instructions.
   */
  renderFrame(time) {
    this.ctx.save();

    // 1. Process screen shake offsets
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShakeTime > 0) {
      shakeX = (Math.random() * 2 - 1) * this.cameraShakeMagnitude;
      shakeY = (Math.random() * 2 - 1) * this.cameraShakeMagnitude;
      this.cameraShakeTime--;
    }
    this.ctx.translate(shakeX, shakeY);

    // 2. Draw sky backdrop gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, 400);
    skyGrad.addColorStop(0, '#0d0f20'); // deep navy
    skyGrad.addColorStop(1, '#1b1a30'); // indigo sunset tint
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw stylized background elements (Sun / Moon)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    this.ctx.beginPath();
    this.ctx.arc(400, 300, 180, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
    this.ctx.beginPath();
    this.ctx.arc(400, 300, 240, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw mountains silhouettes in background
    this.ctx.fillStyle = '#141525';
    this.ctx.beginPath();
    this.ctx.moveTo(0, 400);
    this.ctx.lineTo(150, 280);
    this.ctx.lineTo(350, 400);
    this.ctx.lineTo(550, 220);
    this.ctx.lineTo(800, 400);
    this.ctx.closePath();
    this.ctx.fill();

    // 3. Draw Textured Ground
    this.ctx.fillStyle = '#1c1e30'; // floor shadow
    this.ctx.fillRect(0, 400, this.canvas.width, 100);

    const groundGrad = this.ctx.createLinearGradient(0, 400, 0, 500);
    groundGrad.addColorStop(0, '#242742'); // primary floor
    groundGrad.addColorStop(1, '#151726'); // deep ground
    this.ctx.fillStyle = groundGrad;
    this.ctx.fillRect(0, 403, this.canvas.width, 97);

    // Ground boundary lines details
    this.ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 400);
    this.ctx.lineTo(800, 400);
    this.ctx.stroke();

    // 4. Draw sword motion trails (behind characters)
    [this.p1, this.p2].forEach(p => {
      if (p && p.trailHistory && p.trailHistory.length > 1) {
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.lineWidth = 5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Shaded path from thin tail to thick strike head
        for (let i = 1; i < p.trailHistory.length; i++) {
          const alpha = i / p.trailHistory.length * 0.35;
          this.ctx.strokeStyle = p.color === 'red' ? `rgba(255, 51, 102, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
          this.ctx.beginPath();
          this.ctx.moveTo(p.trailHistory[i - 1].x, p.trailHistory[i - 1].y);
          this.ctx.lineTo(p.trailHistory[i].x, p.trailHistory[i].y);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }
    });

    // 5. Draw dust smoke particles
    this.dustParticles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = 'rgba(156, 163, 175, 0.8)'; // grey smoke
      this.ctx.shadowBlur = 0;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 6. Draw Spark particles
    this.updateParticles();
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 6.5. Update and Draw Mock Sequence Entities
    if (this.mockSequenceActive) {
      if (this.mockLoser) {
        this.mockLoser.action = 'knockdown';
        this.mockLoser.actionTimer = 900;
        this.mockLoser.maxActionTimer = 1500;
      }

      if (this.airplane) {
        this.airplane.x += this.airplane.vx;
        this.drawAirplane(this.ctx, this.airplane.x, this.airplane.y);

        if (this.airplane.x >= this.airplane.targetX && !this.airplane.bombDropped) {
          this.airplane.bombDropped = true;
          this.bomb = {
            x: this.airplane.x,
            y: this.airplane.y + 15,
            vy: 0,
            ay: 0.18
          };
          window.audio.playTone(600, 'sine', 0.15, 0.4);
          setTimeout(() => {
            if (this.mockSequenceActive) window.audio.playTone(450, 'sine', 0.15, 0.4);
          }, 300);
          setTimeout(() => {
            if (this.mockSequenceActive) window.audio.playTone(300, 'sine', 0.15, 0.4);
          }, 600);
        }

        if (this.airplane.x > 900) {
          this.airplane = null;
        }
      }

      if (this.bomb) {
        this.bomb.vy += this.bomb.ay;
        this.bomb.y += this.bomb.vy;
        this.drawAtomicBomb(this.ctx, this.bomb.x, this.bomb.y);

        if (this.bomb.y >= 390) {
          const impactX = this.bomb.x;
          const impactY = 400;
          this.bomb = null;

          this.spawnExplosionSparks(impactX, impactY);
          this.applyCameraShake(35);
          this.screenFlashTime = 25;

          if (this.mockLoser) {
            this.mockLoser.action = 'shatter';
            this.mockLoser.isShattered = false;
            this.mockLoser.shatteredParts = [];
            this.mockLoser.opacity = 1.0;
          }

          window.audio.playTone(55, 'sawtooth', 0.8, 1.4);
          window.audio.playTone(110, 'triangle', 0.6, 0.9);
        }
      }
    }

    // 7. Draw Stickman Entities
    if (this.p1) this.p1.draw(this.ctx, time);
    if (this.p2) this.p2.draw(this.ctx, time);

    // 8. Screen Flash Overlay
    if (this.screenFlashTime > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = 1.0;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlashTime / 25})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
      this.screenFlashTime--;
    }

    this.ctx.restore();
  }
}

// Global single instance export
window.battle = new BattleManager();

