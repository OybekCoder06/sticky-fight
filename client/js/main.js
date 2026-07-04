/**
 * Main application coordinator for sticky-fight
 * Configures event listeners, screen transitions, and character selection preview loop.
 */

const CONFIG = {
  nickname: 'Player_' + Math.floor(1000 + Math.random() * 9000),
  selectedColor: 'green',
  gameMode: 'single', // 'single' or 'multi'
  difficulty: 'easy', // 'easy', 'normal', 'hard'
  roomCode: null,
  playerRole: null, // 'player1', 'player2', 'spectator'
  isReady: false,
  backendUrl: localStorage.getItem('backend_url') || new URLSearchParams(window.location.search).get('backend') || ''
};

// Character Description Texts
const HERO_DESCRIPTIONS = {
  green: "Yashil (Chidamlilik): Ko'proq jonga ega bo'lib, jangni 115 HP bilan boshlaydi.",
  yellow: "Sariq (Tezkorlik): Harakat tezligi 20% yuqori. Raqibdan osonlikcha qochadi.",
  blue: "Moviy (Qalqon): Tank xususiyati. Bloklanganda zararni 90% neytrallaydi (75% o'rniga).",
  red: "Qizil (Shiddat): Hujum tezligi 15% yuqori. Tez-tez zarba beradi."
};

// Preview canvas configurations
let previewCanvas, previewCtx, previewStickman;
let previewLoopId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initial elements config
  const nicknameInput = document.getElementById('input-nickname');
  if (nicknameInput) {
    nicknameInput.value = CONFIG.nickname;
    nicknameInput.addEventListener('input', (e) => {
      CONFIG.nickname = e.target.value.trim() || 'Player_' + Math.floor(1000 + Math.random() * 9000);
    });
  }

  // --- BUTTON NAVIGATION EVENTS ---
  
  // Rules modal toggling
  const modalRules = document.getElementById('modal-rules');
  document.getElementById('btn-menu-rules').addEventListener('click', () => {
    modalRules.showModal();
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    modalRules.close();
  });

  // Play button on main menu -> goes to Hero Selection
  document.getElementById('btn-menu-play').addEventListener('click', () => {
    window.ui.showScreen('screen-hero');
    startPreviewLoop();
  });

  // Hero select cards clicking
  const heroCards = document.querySelectorAll('.hero-card');
  heroCards.forEach(card => {
    card.addEventListener('click', () => {
      heroCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      const color = card.getAttribute('data-color');
      CONFIG.selectedColor = color;

      // Update descriptions
      document.getElementById('hero-bonus-desc').textContent = HERO_DESCRIPTIONS[color];
      
      // Update preview stickman
      if (previewStickman) {
        previewStickman.color = color;
        previewStickman.boneColor = previewStickman.colors[color];
        previewStickman.glowColor = previewStickman.glowColors[color];
      }
    });
  });

  // Hero Select: Back
  document.getElementById('btn-hero-back').addEventListener('click', () => {
    stopPreviewLoop();
    window.ui.showScreen('screen-menu');
  });

  // Hero Select: Next -> goes to Game Mode screen
  document.getElementById('btn-hero-next').addEventListener('click', () => {
    stopPreviewLoop();
    window.ui.showScreen('screen-mode');
  });

  // Game Mode: Back
  document.getElementById('btn-mode-back').addEventListener('click', () => {
    window.ui.showScreen('screen-hero');
    startPreviewLoop();
  });

  // Difficulty picking in Single Player Mode
  const diffBtns = document.querySelectorAll('.diff-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      CONFIG.difficulty = btn.getAttribute('data-diff');
    });
  });

  // Start Single Player Game
  document.getElementById('btn-start-single').addEventListener('click', () => {
    CONFIG.gameMode = 'single';
    window.ui.showScreen('screen-battle');
    window.battle.startSinglePlayerMatch(CONFIG.selectedColor, CONFIG.difficulty, CONFIG.nickname);
  });

  // Start Multiplayer Menu
  document.getElementById('btn-start-multi-menu').addEventListener('click', () => {
    CONFIG.gameMode = 'multi';
    showMultiplayerSub('choice');
    window.ui.showScreen('screen-multiplayer');
  });

  // --- MULTIPLAYER INNER ROUTING ---
  
  // Lobby options
  document.getElementById('btn-multi-create').addEventListener('click', () => {
    window.network.createLobby(CONFIG.nickname);
  });

  document.getElementById('btn-multi-join-flow').addEventListener('click', () => {
    showMultiplayerSub('join');
  });

  document.getElementById('btn-multi-matchmake').addEventListener('click', () => {
    window.network.matchmake(CONFIG.nickname);
  });

  // Join back button
  document.getElementById('btn-join-back').addEventListener('click', () => {
    showMultiplayerSub('choice');
  });

  // Submit Room Code to Join
  document.getElementById('btn-multi-join-submit').addEventListener('click', () => {
    const code = document.getElementById('input-room-code').value.trim();
    if (code.length < 5) {
      const err = document.getElementById('join-error-msg');
      err.textContent = "Kodni to'liq kiriting (5 xona)";
      err.classList.remove('hidden');
      return;
    }
    window.network.joinLobby(code, CONFIG.nickname);
  });

  // Copy code to clipboard
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('room-code-badge').textContent;
    navigator.clipboard.writeText(code).then(() => {
      window.ui.showToast("Lobby kodi nusxalandi!");
    }).catch(err => {
      console.error('Nusxalashda xatolik:', err);
    });
  });

  // Ready state trigger in lobby
  const btnLobbyReady = document.getElementById('btn-lobby-ready');
  btnLobbyReady.addEventListener('click', () => {
    if (btnLobbyReady.classList.contains('disabled')) return;
    
    CONFIG.isReady = !CONFIG.isReady;
    window.network.toggleReady(CONFIG.isReady);
    btnLobbyReady.textContent = CONFIG.isReady ? "TAYYORMAN ✓" : "TAYYORMAN";
    btnLobbyReady.classList.toggle('btn-accent', CONFIG.isReady);
  });

  // Exit lobby
  document.getElementById('btn-lobby-exit').addEventListener('click', () => {
    window.network.leaveLobby();
    window.ui.showScreen('screen-mode');
  });

  // Exit Multiplayer layout menu
  document.getElementById('btn-multi-back').addEventListener('click', () => {
    window.ui.showScreen('screen-mode');
  });

  // Resign / Exit match button (Battle Arena)
  document.getElementById('btn-battle-exit').addEventListener('click', () => {
    if (confirm("Haqiqatan ham jangni tark etmoqchimisiz?")) {
      if (CONFIG.gameMode === 'multi') {
        window.network.leaveLobby();
      } else {
        window.battle.endMatch();
      }
      window.ui.showScreen('screen-mode');
    }
  });

  // Play again button (Result screen)
  document.getElementById('btn-result-replay').addEventListener('click', () => {
    if (CONFIG.gameMode === 'single') {
      window.ui.showScreen('screen-battle');
      window.battle.startSinglePlayerMatch(CONFIG.selectedColor, CONFIG.difficulty, CONFIG.nickname);
    } else {
      // In multiplayer, return to lobby waiting room
      CONFIG.isReady = false;
      const readyBtn = document.getElementById('btn-lobby-ready');
      readyBtn.textContent = "TAYYORMAN";
      readyBtn.classList.remove('btn-accent');
      
      showMultiplayerSub('lobby');
      window.ui.showScreen('screen-multiplayer');
    }
  });

  // Main menu button (Result screen)
  document.getElementById('btn-result-menu').addEventListener('click', () => {
    if (CONFIG.gameMode === 'multi') {
      window.network.leaveLobby();
    }
    window.ui.showScreen('screen-menu');
  });

});

/**
 * Handles toggling sub-panels within the multiplayer section.
 */
function showMultiplayerSub(subName) {
  const choicePanel = document.getElementById('multi-sub-choice');
  const joinPanel = document.getElementById('multi-sub-join');
  const lobbyPanel = document.getElementById('multi-sub-lobby');
  const backBtn = document.getElementById('btn-multi-back');

  choicePanel.classList.remove('active');
  joinPanel.classList.remove('active');
  lobbyPanel.classList.remove('active');
  backBtn.classList.remove('hidden');

  if (subName === 'choice') {
    choicePanel.classList.add('active');
  } else if (subName === 'join') {
    joinPanel.classList.add('active');
    document.getElementById('input-room-code').value = '';
    document.getElementById('join-error-msg').classList.add('hidden');
  } else if (subName === 'lobby') {
    lobbyPanel.classList.add('active');
    backBtn.classList.add('hidden'); // exit through exit lobby button
  }
}

/**
 * Animates the chosen character on the Hero Selection screen.
 */
function startPreviewLoop() {
  previewCanvas = document.getElementById('hero-preview-canvas');
  if (!previewCanvas) return;
  
  previewCtx = previewCanvas.getContext('2d');
  previewStickman = new window.Stickman(CONFIG.selectedColor, true);
  previewStickman.update(100, 190, 100, 'idle', 1, 0);

  const loop = (timestamp) => {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Draw background highlight/shadow base
    previewCtx.fillStyle = 'rgba(255,255,255,0.015)';
    previewCtx.beginPath();
    previewCtx.arc(100, 190, 50, 0, Math.PI * 2);
    previewCtx.fill();

    // Redraw and cycle breathing animation
    previewStickman.draw(previewCtx, timestamp);
    
    previewLoopId = requestAnimationFrame(loop);
  };
  
  previewLoopId = requestAnimationFrame(loop);
}

function stopPreviewLoop() {
  if (previewLoopId) {
    cancelAnimationFrame(previewLoopId);
    previewLoopId = null;
  }
}

// Global configs exports
window.CONFIG = CONFIG;
window.showMultiplayerSub = showMultiplayerSub;
