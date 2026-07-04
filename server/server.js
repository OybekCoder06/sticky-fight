const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const roomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static client files
app.use(express.static(path.join(__dirname, '../client')));

// Redirect all root traffic to client index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Map to track which socket belongs to which room
// socket.id -> { roomCode, role }
const socketRegistry = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create-room', (data, callback) => {
    try {
      const nickname = data?.nickname;
      const room = roomManager.createRoom();
      const joinResult = roomManager.joinRoom(room.code, socket.id, nickname);
      
      socket.join(room.code);
      socketRegistry.set(socket.id, { roomCode: room.code, role: joinResult.role });
      
      console.log(`[Room] Room created: ${room.code} by ${socket.id}`);
      
      callback({
        success: true,
        roomCode: room.code,
        role: joinResult.role,
        room: getSerializableRoom(room)
      });
    } catch (err) {
      console.error(err);
      callback({ success: false, error: 'Xona yaratishda xatolik yuz berdi.' });
    }
  });

  // 2. Join Room
  socket.on('join-room', (data, callback) => {
    try {
      const code = data?.roomCode?.toUpperCase();
      const nickname = data?.nickname;

      if (!code) {
        return callback({ success: false, error: 'Xona kodi kiritilmadi.' });
      }

      const room = roomManager.getRoom(code);
      if (!room) {
        return callback({ success: false, error: 'Bunday kodli xona mavjud emas!' });
      }

      // Check duplicate colors in lobby
      const joinResult = roomManager.joinRoom(code, socket.id, nickname);
      if (!joinResult.success) {
        return callback({ success: false, error: joinResult.error });
      }

      socket.join(code);
      socketRegistry.set(socket.id, { roomCode: code, role: joinResult.role });

      console.log(`[Room] User ${socket.id} joined room ${code} as ${joinResult.role}`);

      // Notify others in room
      socket.to(code).emit('player-joined', {
        role: joinResult.role,
        room: getSerializableRoom(room)
      });

      callback({
        success: true,
        roomCode: code,
        role: joinResult.role,
        room: getSerializableRoom(room)
      });
    } catch (err) {
      console.error(err);
      callback({ success: false, error: 'Xonaga ulanishda xatolik yuz berdi.' });
    }
  });

  // 3. Matchmaking
  socket.on('join-random-room', (data, callback) => {
    try {
      const nickname = data?.nickname;
      let targetRoom = null;

      // Search for room in lobby state with exactly 1 player
      for (const [code, r] of roomManager.rooms.entries()) {
        if (r.gameState === 'lobby' && r.players.size === 1) {
          targetRoom = r;
          break;
        }
      }

      if (targetRoom) {
        // Found room
        const joinResult = roomManager.joinRoom(targetRoom.code, socket.id, nickname);
        if (joinResult.success) {
          socket.join(targetRoom.code);
          socketRegistry.set(socket.id, { roomCode: targetRoom.code, role: joinResult.role });
          
          socket.to(targetRoom.code).emit('player-joined', {
            role: joinResult.role,
            room: getSerializableRoom(targetRoom)
          });

          return callback({
            success: true,
            roomCode: targetRoom.code,
            role: joinResult.role,
            room: getSerializableRoom(targetRoom)
          });
        }
      }

      // No open rooms, create a new one
      const room = roomManager.createRoom();
      const joinResult = roomManager.joinRoom(room.code, socket.id, nickname);
      
      socket.join(room.code);
      socketRegistry.set(socket.id, { roomCode: room.code, role: joinResult.role });

      callback({
        success: true,
        roomCode: room.code,
        role: joinResult.role,
        room: getSerializableRoom(room)
      });
    } catch (err) {
      console.error(err);
      callback({ success: false, error: 'Matchmakingda xatolik yuz berdi.' });
    }
  });

  // 4. Select Hero Color
  socket.on('select-hero', (data, callback) => {
    const reg = socketRegistry.get(socket.id);
    if (!reg) return callback({ success: false, error: 'Siz faol xonada emassiz.' });

    const room = roomManager.getRoom(reg.roomCode);
    if (!room) return callback({ success: false, error: 'Xona topilmadi.' });

    const color = data?.color; // 'green', 'yellow', 'blue', 'red'
    if (!['green', 'yellow', 'blue', 'red'].includes(color)) {
      return callback({ success: false, error: 'Noto\'g\'ri qahramon tanlandi.' });
    }

    // Check if color is already chosen in the room
    let colorTaken = false;
    for (const [pid, player] of room.players.entries()) {
      if (pid !== socket.id && player.heroColor === color) {
        colorTaken = true;
        break;
      }
    }

    if (colorTaken) {
      return callback({ success: false, error: 'Bu rang band, boshqasini tanlang!' });
    }

    const player = room.players.get(socket.id);
    if (player) {
      player.heroColor = color;
      // Configure stats based on color
      if (color === 'green') {
        player.maxHp = 115;
      } else {
        player.maxHp = 100;
      }
      player.hp = player.maxHp;
      
      io.to(reg.roomCode).emit('lobby-update', { room: getSerializableRoom(room) });
      callback({ success: true });
    } else {
      callback({ success: false, error: 'O\'yinchi topilmadi.' });
    }
  });

  // 5. Ready Status
  socket.on('set-ready', (data, callback) => {
    const reg = socketRegistry.get(socket.id);
    if (!reg) return callback({ success: false, error: 'Siz faol xonada emassiz.' });

    const room = roomManager.getRoom(reg.roomCode);
    if (!room) return callback({ success: false, error: 'Xona topilmadi.' });

    const player = room.players.get(socket.id);
    if (!player) return callback({ success: false, error: 'O\'yinchi topilmadi.' });

    if (!player.heroColor) {
      return callback({ success: false, error: 'Avval qahramon tanlang!' });
    }

    player.ready = data.ready;
    io.to(reg.roomCode).emit('lobby-update', { room: getSerializableRoom(room) });

    // Check if all players (exactly 2) are ready
    const playersArr = Array.from(room.players.values());
    if (playersArr.length === 2 && playersArr.every(p => p.ready)) {
      startMatch(room);
    }

    callback({ success: true });
  });

  // 6. Action Inputs (from client to authoritative physics loop)
  socket.on('player-input', (inputs) => {
    const reg = socketRegistry.get(socket.id);
    if (!reg) return;

    const room = roomManager.getRoom(reg.roomCode);
    if (!room || room.gameState !== 'playing') return;

    const player = room.players.get(socket.id);
    if (player && player.action !== 'death') {
      player.inputs = {
        left: !!inputs.left,
        right: !!inputs.right,
        up: !!inputs.up,
        attack: !!inputs.attack,
        block: !!inputs.block
      };
    }
  });

  // 7. Spectate Room
  socket.on('spectate-room', (data, callback) => {
    const code = data?.roomCode?.toUpperCase();
    if (!code) return callback({ success: false, error: 'Xona kodi yo\'q.' });

    const room = roomManager.getRoom(code);
    if (!room) return callback({ success: false, error: 'Xona topilmadi.' });

    socket.join(code);
    room.spectators.add(socket.id);
    socketRegistry.set(socket.id, { roomCode: code, role: 'spectator' });

    callback({
      success: true,
      roomCode: code,
      role: 'spectator',
      room: getSerializableRoom(room)
    });
  });

  // 8. Disconnect Handling
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    handleUserExit(socket.id);
  });

  socket.on('leave-room', () => {
    handleUserExit(socket.id);
  });
});

/**
 * Handle player exiting room or losing connection.
 */
function handleUserExit(socketId) {
  const reg = socketRegistry.get(socketId);
  if (!reg) return;

  const roomCode = reg.roomCode;
  const role = reg.role;

  socketRegistry.delete(socketId);

  const room = roomManager.rooms.get(roomCode);
  if (!room) return;

  // Notify remaining clients
  io.to(roomCode).emit('player-left', { socketId, role });

  // Update room manager
  const updatedRoom = roomManager.leaveRoom(roomCode, socketId);

  if (updatedRoom) {
    if (updatedRoom.gameState === 'playing' && (role === 'player1' || role === 'player2')) {
      // Opponent left during match, remaining player wins automatically
      stopRoomLoop(updatedRoom);
      updatedRoom.gameState = 'gameover';
      const remainingPlayer = Array.from(updatedRoom.players.values())[0];
      io.to(roomCode).emit('opponent-disconnected', {
        winnerNickname: remainingPlayer ? remainingPlayer.nickname : 'Raqib',
        reason: 'Raqib o\'yindan chiqib ketdi!'
      });
    } else {
      io.to(roomCode).emit('lobby-update', { room: getSerializableRoom(updatedRoom) });
    }
  }
}

/**
 * Serializes Room maps into plain arrays/objects for Socket JSON transmission.
 */
function getSerializableRoom(room) {
  return {
    code: room.code,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      role: p.role,
      heroColor: p.heroColor,
      ready: p.ready,
      hp: p.hp,
      maxHp: p.maxHp,
      x: p.x,
      y: p.y,
      action: p.action,
      actionTimer: p.actionTimer,
      direction: p.direction,
      combo: p.combo
    })),
    spectatorsCount: room.spectators.size,
    gameState: room.gameState,
    score: room.score,
    rounds: room.rounds
  };
}

// Map to track running interval loops for active game rooms
const activeLoops = new Map();

/**
 * Initialize and start the authoritative game loops for the room.
 */
function startMatch(room) {
  room.gameState = 'playing';
  room.score = { p1: 0, p2: 0 };
  room.rounds = [];

  io.to(room.code).emit('game-start', { room: getSerializableRoom(room) });
  
  startRound(room);
}

/**
 * Starts a new round in the match.
 */
function startRound(room) {
  stopRoomLoop(room);

  // Setup player starting positions and stats
  const players = Array.from(room.players.values());
  const p1 = players.find(p => p.role === 'player1');
  const p2 = players.find(p => p.role === 'player2');

  if (!p1 || !p2) return;

  // Apply maximum HP based on stats
  p1.hp = p1.maxHp;
  p2.hp = p2.maxHp;

  // Positioning
  p1.x = 200;
  p1.y = 400;
  p1.vy = 0;
  p1.direction = 1;
  p1.action = 'idle';
  p1.inputs = { left: false, right: false, attack: false, block: false };
  p1.actionTimer = 0;
  p1.cooldowns = { attack: 0 };
  p1.combo = 0;

  p2.x = 600;
  p2.y = 400;
  p2.vy = 0;
  p2.direction = -1;
  p2.action = 'idle';
  p2.inputs = { left: false, right: false, attack: false, block: false };
  p2.actionTimer = 0;
  p2.cooldowns = { attack: 0 };
  p2.combo = 0;

  let countdown = 3;
  io.to(room.code).emit('round-countdown', { count: countdown });

  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      io.to(room.code).emit('round-countdown', { count: countdown });
    } else if (countdown === 0) {
      io.to(room.code).emit('round-countdown', { count: 'JANG!' }); // FIGHT!
      clearInterval(countdownInterval);
      
      // Start the core 60 FPS authoritative update loop
      runActiveGameLoop(room, p1, p2);
    }
  }, 1000);
}

/**
 * Clears physics loop interval for a room.
 */
function stopRoomLoop(room) {
  if (activeLoops.has(room.code)) {
    clearInterval(activeLoops.get(room.code));
    activeLoops.delete(room.code);
  }
}

/**
 * The authoritative physics tick loop (60 FPS).
 */
function runActiveGameLoop(room, p1, p2) {
  const tickRate = 60;
  const dt = 1000 / tickRate;

  const intervalId = setInterval(() => {
    // 1. Process player actions, state changes, cooldowns, timers
    updatePlayerPhysics(p1, p2, room);
    updatePlayerPhysics(p2, p1, room);

    // 2. Check collision/attacks
    checkCombatCollisions(p1, p2, room);
    checkCombatCollisions(p2, p1, room);

    // 3. Sync player states to clients
    io.to(room.code).emit('room-state', {
      players: [
        { id: p1.id, x: p1.x, y: p1.y, hp: p1.hp, maxHp: p1.maxHp, action: p1.action, direction: p1.direction, combo: p1.combo },
        { id: p2.id, x: p2.x, y: p2.y, hp: p2.hp, maxHp: p2.maxHp, action: p2.action, direction: p2.direction, combo: p2.combo }
      ]
    });

    // 4. Check for round end
    if (p1.hp <= 0 || p2.hp <= 0) {
      stopRoomLoop(room);
      handleRoundEnd(room, p1, p2);
    }
  }, dt);

  activeLoops.set(room.code, intervalId);
}

/**
 * Update positioning, speed modifiers, boundaries and states.
 */
function updatePlayerPhysics(player, opponent, room) {
  if (player.action === 'death') return;

  // Initialize vertical registers if missing
  if (player.y === undefined) player.y = 400;
  if (player.vy === undefined) player.vy = 0;

  // Decrease animation action lock timer
  if (player.actionTimer > 0) {
    player.actionTimer -= 16.67; // approx ms per frame
    if (player.actionTimer <= 0) {
      player.actionTimer = 0;
      player.action = 'idle';
    }
  }

  // Decrease cooldowns
  if (player.cooldowns.attack > 0) {
    player.cooldowns.attack -= 16.67;
  }

  // Vertical movement (Jumping physics)
  if (player.y < 400) {
    player.vy += 0.5; // gravity
    player.y += player.vy;
    if (player.y >= 400) {
      player.y = 400;
      player.vy = 0;
    }
  } else if (player.inputs?.up && player.action !== 'knockdown' && player.action !== 'hit_reaction') {
    player.vy = -11; // jump impulse velocity
    player.y += player.vy;
  }

  // Horizontal motion parameters
  let speed = 4; // base speed
  if (player.heroColor === 'yellow') {
    speed = 4.8; // Yellow speed bonus (+20%)
  }

  // If in block or hit reaction, restrict movements
  if (player.action === 'block') {
    speed = 1.0; // slowed while blocking
  }

  // If locked in action (attack, hit, knockdown), player cannot move horizontally
  const isLocked = ['attack', 'hit_reaction', 'knockdown'].includes(player.action);

  if (!isLocked) {
    let moving = false;
    let dx = 0;

    if (player.inputs?.left) {
      dx -= speed;
      moving = true;
    }
    if (player.inputs?.right) {
      dx += speed;
      moving = true;
    }

    player.x += dx;

    // Apply facing direction relative to opponent automatically
    if (player.x < opponent.x) {
      player.direction = 1;
    } else {
      player.direction = -1;
    }

    if (moving) {
      // Determine if moving forward or backward based on movement direction vs opponent
      const movingForward = (dx > 0 && player.direction === 1) || (dx < 0 && player.direction === -1);
      player.action = movingForward ? 'move_forward' : 'move_back';
    } else {
      if (player.inputs?.block) {
        player.action = 'block';
      } else {
        player.action = 'idle';
      }
    }

    // If in the air and not attacking/blocking, set action to jump
    if (player.y < 400 && player.action !== 'block') {
      player.action = 'jump';
    }
  }

  // Handle blocking input override if not locked
  if (!isLocked && player.inputs?.block) {
    player.action = 'block';
  }

  // Handle attack trigger
  if (!isLocked && player.inputs?.attack && player.cooldowns.attack <= 0) {
    player.action = 'attack';
    // 3-phase attack model timing (Red is 15% faster)
    const attackDuration = player.heroColor === 'red' ? 380 : 450;
    player.actionTimer = attackDuration;
    player.cooldowns.attack = attackDuration + 150; // duration + cooldown buffer
    player.hasStruckThisAttack = false; // Flag to prevent multiple hits per swing
    player.inputs.attack = false; // Reset input trigger
  }

  // Arena boundaries
  if (player.x < 50) player.x = 50;
  if (player.x > 750) player.x = 750;
}

/**
 * Handle sword hit detection.
 */
function checkCombatCollisions(attacker, target, room) {
  // Can't hit if target is already dead, knocked down (invulnerable grace period), or attacker is not attacking
  if (attacker.action !== 'attack' || attacker.hasStruckThisAttack) return;
  if (target.action === 'death' || target.action === 'knockdown') return;

  // We check for hit at the Windup / Strike boundary
  // Red windup: 150ms. Others windup: 180ms.
  // actionTimer counts down from max (380ms for Red, 450ms for others)
  const strikeTriggerThreshold = attacker.heroColor === 'red' ? 230 : 270;
  
  if (attacker.actionTimer > strikeTriggerThreshold) return; // Still in windup phase!

  // Perform collision check
  const distance = Math.abs(attacker.x - target.x);
  
  // Sword reach: 75px. Stickman spacing allowance: 30px. Total reach: 105px.
  // Add vertical reach tolerance of 80px for aerial attacks
  const verticalDiff = Math.abs(attacker.y - target.y);
  const swordReach = 105;
  const isFacingTarget = (attacker.x < target.x && attacker.direction === 1) || 
                         (attacker.x > target.x && attacker.direction === -1);

  if (distance <= swordReach && verticalDiff <= 80 && isFacingTarget) {
    // Attack connects!
    attacker.hasStruckThisAttack = true;

    // Check if target is blocking and facing the attacker
    const targetIsBlocking = target.action === 'block';
    
    // Calculate damage
    let baseDamage = Math.floor(5 + Math.random() * 8); // 5 to 12
    let damage = baseDamage;
    let isBlocked = false;

    if (targetIsBlocking) {
      isBlocked = true;
      // Blue character blocks 90% of damage, others block 75%
      const blockReduction = target.heroColor === 'blue' ? 0.90 : 0.75;
      damage = Math.max(1, Math.round(baseDamage * (1 - blockReduction)));
    }

    // Apply combo logic
    let isComboBonus = false;
    const now = Date.now();
    if (now - attacker.lastHitTime < 1500) {
      attacker.combo++;
      if (attacker.combo >= 3) {
        damage += 5; // Combo x3 bonus damage
        attacker.combo = 0; // reset
        isComboBonus = true;
      }
    } else {
      attacker.combo = 1;
    }
    attacker.lastHitTime = now;

    // Apply damage
    target.hp = Math.max(0, target.hp - damage);

    // Knockdown check: deals 10+ damage OR target health drops below 20%
    const triggerKnockdown = (damage >= 10 || target.hp < 20) && target.hp > 0;

    if (triggerKnockdown) {
      target.action = 'knockdown';
      target.actionTimer = 1500; // 1.5s locked time (invulnerable)
      target.vy = -5; // bounce up slightly
      target.y += target.vy;
      target.x += attacker.direction * 50; // Larger knockback
    } else if (!targetIsBlocking) {
      target.action = 'hit_reaction';
      target.actionTimer = 220; // Stun duration
      target.x += attacker.direction * 35; // Knockback distance
    } else {
      target.x += attacker.direction * 10; // Small knockback on block
    }

    // Keep within boundaries after knockback
    if (target.x < 50) target.x = 50;
    if (target.x > 750) target.x = 750;

    // Broadcast hit-effect to clients
    io.to(room.code).emit('hit-effect', {
      attackerId: attacker.id,
      targetId: target.id,
      x: (attacker.x + target.x) / 2,
      y: (attacker.y + target.y) / 2 - 30, // Spark center
      damage,
      isBlocked,
      isComboBonus,
      isKnockdown: triggerKnockdown,
      cameraShake: triggerKnockdown ? 12 : (targetIsBlocking ? 3 : 8)
    });
  }
}

/**
 * Handle Round Ends.
 */
function handleRoundEnd(room, p1, p2) {
  let winner = null;
  if (p1.hp <= 0 && p2.hp <= 0) {
    // Double KO - rare draw
    winner = 'draw';
  } else if (p1.hp <= 0) {
    winner = p2;
    room.score.p2++;
  } else {
    winner = p1;
    room.score.p1++;
  }

  const roundResult = {
    winnerNickname: winner === 'draw' ? 'Durang' : winner.nickname,
    winnerRole: winner === 'draw' ? 'draw' : winner.role,
    score: room.score,
    roundsCount: room.rounds.length + 1
  };

  room.rounds.push(roundResult.winnerRole);
  io.to(room.code).emit('round-ended', roundResult);

  // Check match winner (Best of 3 -> first to 2 round wins)
  if (room.score.p1 === 2 || room.score.p2 === 2) {
    room.gameState = 'gameover';
    const matchWinner = room.score.p1 === 2 ? p1 : p2;
    
    setTimeout(() => {
      io.to(room.code).emit('match-ended', {
        winnerNickname: matchWinner.nickname,
        winnerRole: matchWinner.role,
        score: room.score
      });
      // Reset players ready state for lobby
      p1.ready = false;
      p2.ready = false;
    }, 2000);
  } else {
    // Start next round after 3 seconds
    setTimeout(() => {
      startRound(room);
    }, 3000);
  }
}

// Start Server listening
server.listen(PORT, () => {
  console.log(`[sticky-fight] Server listening on http://localhost:${PORT}`);
});
