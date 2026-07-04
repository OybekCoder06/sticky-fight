/**
 * Network Manager for sticky-fight
 * Coordinates Socket.io real-time multiplayer synchronization and events mappings.
 */

class NetworkManager {
  constructor() {
    this.socket = null;
    this.pingInterval = null;
    this.lastPingTime = 0;
  }

  /**
   * Initializes the WebSocket connection.
   */
  connect() {
    if (this.socket) return;
    
    // Connect to the hosting server port or external backend
    const serverUrl = CONFIG.backendUrl || '';
    this.socket = io(serverUrl);

    this.socket.on('connect', () => {
      console.log('[Network] Connected to Socket server.');
      this.startPingTracker();
    });

    this.socket.on('disconnect', () => {
      console.log('[Network] Disconnected.');
      window.ui.showToast('Server bilan aloqa uzildi.');
      this.stopPingTracker();
    });

    // --- SOCKET EVENT LISTENERS ---

    // Lobby sync update
    this.socket.on('lobby-update', (data) => {
      this.syncLobbyUI(data.room);
    });

    // Player joined lobby notification
    this.socket.on('player-joined', (data) => {
      const remaining = data.room.players.find(p => p.id !== this.socket.id);
      if (remaining) {
        window.ui.showToast(`${remaining.nickname} xonaga qo'shildi!`);
        window.audio.playTone(600, 'sine', 0.1, 0.1);
      }
      this.syncLobbyUI(data.room);
    });

    // Player left lobby notification
    this.socket.on('player-left', (data) => {
      window.ui.showToast(`O'yinchi xonadan chiqdi.`);
      window.audio.playTone(300, 'sine', 0.15, 0.1);
    });

    // Opponent disconnected mid-match
    this.socket.on('opponent-disconnected', (data) => {
      window.audio.playVictory();
      window.battle.endMatch();
      
      const title = document.getElementById('result-title');
      const desc = document.getElementById('result-desc');
      const score = document.getElementById('res-score-vals');
      
      title.textContent = "Siz G'alaba Qozondingiz!";
      title.style.color = "var(--color-green)";
      desc.textContent = data.reason; // "Raqib o'yindan chiqib ketdi!"
      score.textContent = "KO";

      window.ui.showScreen('screen-result');
    });

    // Game starting (both ready)
    this.socket.on('game-start', (data) => {
      window.ui.showToast('Jang boshlanmoqda!');
      window.ui.showScreen('screen-battle');
      window.battle.initMultiplayerMatch(data.room, this.socket.id);
    });

    // Round countdown events (3, 2, 1, FIGHT!)
    this.socket.on('round-countdown', (data) => {
      const announcer = document.getElementById('battle-announcement');
      if (!announcer) return;

      announcer.textContent = data.count;
      announcer.classList.remove('hidden');
      
      // Flash animation style
      announcer.style.animation = 'none';
      void announcer.offsetHeight; // trigger reflow
      announcer.style.animation = 'announcement-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

      // Countdown audio synthesis beeps
      if (typeof data.count === 'number') {
        window.audio.playTone(400, 'triangle', 0.08, 0.1);
      } else {
        // "JANG!" (FIGHT!) high pitch beep
        window.audio.playTone(880, 'sine', 0.25, 0.15);
        setTimeout(() => announcer.classList.add('hidden'), 1000);
      }
    });

    // Authoritative position/state synchronization ticks
    this.socket.on('room-state', (data) => {
      window.battle.syncMultiplayerStates(data.players);
    });

    // Combat impact event broadcasted
    this.socket.on('hit-effect', (data) => {
      // Trigger canvas impact sparks
      window.battle.spawnSparks(data.x, data.y, data.isBlocked ? '#cda200' : '#ff3366');
      
      // Synthesize audio based on block/hit
      if (data.isBlocked) {
        window.audio.playBlock();
      } else {
        window.audio.playHit();
      }

      // Apply screen camera shake effect
      window.battle.applyCameraShake(data.cameraShake);
      
      // Update UI combo meter alerts
      const hitRole = data.attackerId === this.socket.id ? 'p1' : 'p2';
      const playerNum = hitRole === 'p1' ? 1 : 2;
      
      // Read state update combos
      const attacker = window.battle.p1.id === data.attackerId ? window.battle.p1 : window.battle.p2;
      attacker.combo++;
      window.ui.triggerComboIndicator(playerNum, attacker.combo);
      
      if (data.isComboBonus) {
        window.ui.showToast('Combo bonus! +5 zarar');
      }

      if (data.isKnockdown) {
        const targetStickman = window.battle.p1.id === data.targetId ? window.battle.p1 : window.battle.p2;
        if (targetStickman) {
          window.battle.spawnDust(targetStickman.x, 400, 0, 16);
        }
        window.audio.playTone(100, 'sawtooth', 0.2, 0.25);
      }
    });

    // Round complete
    this.socket.on('round-ended', (data) => {
      const announcer = document.getElementById('battle-announcement');
      announcer.textContent = data.winnerRole === 'draw' ? 'DURANG!' : `${data.winnerNickname} G'OLIB!`;
      announcer.classList.remove('hidden');

      // Update rounds won HUD dots
      window.ui.updateRoundScores(data.score.p1, data.score.p2);

      // Play soft chime
      window.audio.playTone(523.25, 'sine', 0.4, 0.15); // C5 note

      setTimeout(() => {
        announcer.classList.add('hidden');
      }, 2500);
    });

    // Full match complete (one player reached 2 round wins)
    this.socket.on('match-ended', (data) => {
      window.battle.endMatch();
      
      const title = document.getElementById('result-title');
      const desc = document.getElementById('result-desc');
      const scoreVal = document.getElementById('res-score-vals');
      const p1Label = document.getElementById('res-p1-name');
      const p2Label = document.getElementById('res-p2-name');

      const isLocalWinner = data.winnerRole === window.CONFIG.playerRole;
      
      title.textContent = isLocalWinner ? "Siz G'alaba Qozondingiz!" : "Siz Mag'lub Bo'ldingiz...";
      title.style.color = isLocalWinner ? "var(--color-green)" : "var(--color-red)";
      desc.textContent = `2-o'yinchi orasidagi 3 raundlik jang yakunlandi.`;
      
      // Set results values
      p1Label.textContent = "Siz";
      p2Label.textContent = "Raqib";
      
      // Format score
      const p1Wins = window.CONFIG.playerRole === 'player1' ? data.score.p1 : data.score.p2;
      const p2Wins = window.CONFIG.playerRole === 'player1' ? data.score.p2 : data.score.p1;
      scoreVal.textContent = `${p1Wins} - ${p2Wins}`;

      // Play victory/defeat audio
      if (isLocalWinner) {
        window.audio.playVictory();
      } else {
        window.audio.playDefeat();
      }

      window.ui.showScreen('screen-result');
    });

    // Pong response to track ping latency
    this.socket.on('pong-latency', () => {
      const ping = Date.now() - this.lastPingTime;
      const pingTxt = document.getElementById('ping-indicator');
      if (pingTxt) {
        pingTxt.textContent = `Ping: ${ping}ms`;
        pingTxt.classList.remove('hidden');
      }
    });
  }

  /**
   * Starts a ping evaluation timer loops.
   */
  startPingTracker() {
    this.stopPingTracker();
    this.pingInterval = setInterval(() => {
      if (this.socket) {
        this.lastPingTime = Date.now();
        this.socket.emit('ping-latency');
      }
    }, 2000);
  }

  stopPingTracker() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Triggers lobby creation event.
   */
  createLobby(nickname) {
    this.connect();
    window.ui.showLoading('Lobby yaratilmoqda...');

    this.socket.emit('create-room', { nickname }, (response) => {
      window.ui.hideLoading();
      if (response.success) {
        window.CONFIG.roomCode = response.roomCode;
        window.CONFIG.playerRole = response.role;
        window.CONFIG.isReady = false;

        document.getElementById('room-code-badge').textContent = response.roomCode;
        this.syncLobbyUI(response.room);
        
        window.showMultiplayerSub('lobby');

        // Select hero automatically
        this.autoSelectHeroInLobby(response.room);
      } else {
        window.ui.showToast(response.error || 'Xatolik yuz berdi.');
      }
    });
  }

  /**
   * Joins a lobby via code.
   */
  joinLobby(roomCode, nickname) {
    this.connect();
    window.ui.showLoading('Lobbyga ulanilmoqda...');

    this.socket.emit('join-room', { roomCode, nickname }, (response) => {
      window.ui.hideLoading();
      if (response.success) {
        window.CONFIG.roomCode = response.roomCode;
        window.CONFIG.playerRole = response.role;
        window.CONFIG.isReady = false;

        document.getElementById('room-code-badge').textContent = response.roomCode;
        this.syncLobbyUI(response.room);
        
        window.showMultiplayerSub('lobby');

        // Select hero automatically
        this.autoSelectHeroInLobby(response.room);
      } else {
        const errEl = document.getElementById('join-error-msg');
        errEl.textContent = response.error || 'Ulanib bo\'lmadi.';
        errEl.classList.remove('hidden');
      }
    });
  }

  /**
   * Random matchmaking system triggers.
   */
  matchmake(nickname) {
    this.connect();
    window.ui.showLoading('Mos xona qidirilmoqda...');

    this.socket.emit('join-random-room', { nickname }, (response) => {
      window.ui.hideLoading();
      if (response.success) {
        window.CONFIG.roomCode = response.roomCode;
        window.CONFIG.playerRole = response.role;
        window.CONFIG.isReady = false;

        document.getElementById('room-code-badge').textContent = response.roomCode;
        this.syncLobbyUI(response.room);

        window.showMultiplayerSub('lobby');
        window.ui.showToast('Xona topildi!');

        // Select hero automatically
        this.autoSelectHeroInLobby(response.room);
      } else {
        window.ui.showToast('Matchmakingda xatolik yuz berdi.');
      }
    });
  }

  /**
   * Automatically select client color in lobby, resolving duplicates.
   */
  autoSelectHeroInLobby(room) {
    if (window.CONFIG.playerRole === 'spectator') return;

    const color = window.CONFIG.selectedColor;
    this.selectHero(color, (success, err) => {
      if (success) {
        console.log(`Hero color ${color} selected successfully in lobby.`);
      } else {
        // Color is taken, find an available color
        const takenColors = room.players.map(p => p.heroColor).filter(Boolean);
        const colors = ['green', 'yellow', 'blue', 'red'];
        const availableColor = colors.find(c => !takenColors.includes(c));
        
        if (availableColor) {
          this.selectHero(availableColor, (ok, fail) => {
            if (ok) {
              window.CONFIG.selectedColor = availableColor;
              const colorNames = {
                green: 'Yashil 🟢',
                yellow: 'Sariq 🟡',
                blue: 'Moviy 🔵',
                red: 'Qizil 🔴'
              };
              window.ui.showToast(`Rangingiz band bo'lgani uchun, sizga ${colorNames[availableColor] || availableColor} berildi.`);
            } else {
              window.ui.showToast(fail || "Qahramon tanlashda xatolik.");
            }
          });
        }
      }
    });
  }

  /**
   * Syncs character color choice.
   */
  selectHero(color, callback) {
    if (!this.socket) return callback(false, 'Ulanish mavjud emas.');
    this.socket.emit('select-hero', { color }, (response) => {
      if (response.success) {
        callback(true);
      } else {
        callback(false, response.error);
      }
    });
  }

  /**
   * Toggles ready state.
   */
  toggleReady(ready) {
    if (this.socket) {
      this.socket.emit('set-ready', { ready }, (res) => {
        if (!res.success) {
          window.ui.showToast(res.error);
        }
      });
    }
  }

  /**
   * Sends keyboard inputs.
   */
  sendInputs(inputs) {
    if (this.socket) {
      this.socket.emit('player-input', inputs);
    }
  }

  /**
   * Resigns lobby wait or active match.
   */
  leaveLobby() {
    if (this.socket) {
      this.socket.emit('leave-room');
      this.socket.disconnect();
      this.socket = null;
    }
    this.stopPingTracker();
    window.CONFIG.roomCode = null;
    window.CONFIG.playerRole = null;
    window.CONFIG.isReady = false;
  }

  /**
   * Repopulates waiting room cards dynamically.
   */
  syncLobbyUI(room) {
    const p1Card = document.getElementById('lobby-p1-card');
    const p2Card = document.getElementById('lobby-p2-card');
    const specInfo = document.getElementById('lobby-spectators');
    const specCount = document.getElementById('lobby-spectators-count');
    const readyBtn = document.getElementById('btn-lobby-ready');

    const p1 = room.players.find(p => p.role === 'player1');
    const p2 = room.players.find(p => p.role === 'player2');

    // 1. Sync Player 1 Card
    if (p1) {
      p1Card.classList.remove('empty', 'green', 'yellow', 'blue', 'red');
      if (p1.heroColor) p1Card.classList.add(p1.heroColor);
      
      p1Card.querySelector('.player-name').textContent = p1.nickname + (p1.id === this.socket.id ? ' (Siz)' : '');
      const status = p1Card.querySelector('.player-ready-status');
      status.textContent = p1.ready ? "Tayyor ✓" : "Kutilmoqda";
      p1Card.classList.toggle('ready', p1.ready);
    } else {
      p1Card.className = 'lobby-player-card empty';
      p1Card.querySelector('.player-name').textContent = 'Kutilmoqda...';
      p1Card.querySelector('.player-ready-status').textContent = 'Tayyor emas';
    }

    // 2. Sync Player 2 Card
    if (p2) {
      p2Card.classList.remove('empty', 'green', 'yellow', 'blue', 'red');
      if (p2.heroColor) p2Card.classList.add(p2.heroColor);
      
      p2Card.querySelector('.player-name').textContent = p2.nickname + (p2.id === this.socket.id ? ' (Siz)' : '');
      const status = p2Card.querySelector('.player-ready-status');
      status.textContent = p2.ready ? "Tayyor ✓" : "Kutilmoqda";
      p2Card.classList.toggle('ready', p2.ready);
    } else {
      p2Card.className = 'lobby-player-card empty';
      p2Card.querySelector('.player-name').textContent = 'Kutilmoqda...';
      p2Card.querySelector('.player-ready-status').textContent = 'Tayyor emas';
    }

    // 3. Sync Spectators
    if (room.spectatorsCount > 0) {
      specInfo.classList.remove('hidden');
      specCount.textContent = room.spectatorsCount;
    } else {
      specInfo.classList.add('hidden');
    }

    // 4. Toggle Ready button availability
    // User can click ready only if room has 2 players, and user has selected a hero
    const localPlayer = room.players.find(p => p.id === this.socket.id);
    const hasTwoPlayers = room.players.length === 2;
    const hasChosenHero = localPlayer && localPlayer.heroColor;

    if (hasTwoPlayers && hasChosenHero && window.CONFIG.playerRole !== 'spectator') {
      readyBtn.classList.remove('disabled');
    } else {
      readyBtn.classList.add('disabled');
      // If we got disabled, force unready
      if (window.CONFIG.isReady) {
        window.CONFIG.isReady = false;
        readyBtn.textContent = "TAYYORMAN";
        readyBtn.classList.remove('btn-accent');
      }
    }
  }
}

// Global single instance export
window.network = new NetworkManager();
