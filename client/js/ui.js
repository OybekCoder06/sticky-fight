/**
 * UI and HUD Manager for sticky-fight
 * Handles screen changes, responsive canvas scaling, and toast alerts.
 */

class UIManager {
  constructor() {
    this.screens = document.querySelectorAll('.screen');
    this.toast = document.getElementById('toast-notification');
    this.loading = document.getElementById('loading-overlay');
    this.loadingText = document.getElementById('loading-text');
    this.audioBtn = document.getElementById('btn-audio-toggle');
    
    // Virtual game resolution
    this.gameWidth = 800;
    this.gameHeight = 500;

    this.initAudioToggle();
    this.initCanvasAutoResizer();
  }

  /**
   * Screen routing function.
   */
  showScreen(screenId) {
    this.screens.forEach(screen => {
      if (screen.id === screenId) {
        screen.classList.add('active');
        screen.classList.remove('hidden');
      } else {
        screen.classList.remove('active');
        screen.classList.add('hidden');
      }
    });
    console.log(`[UI] Switched to screen: ${screenId}`);
  }

  /**
   * Displays temporary toast alerts.
   */
  showToast(message, duration = 3000) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    
    // Clear any previous timeouts
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add('hidden');
    }, duration);
  }

  /**
   * Shows/hides a loading overlay during connections.
   */
  showLoading(text = 'Yuklanmoqda...') {
    if (!this.loading) return;
    this.loadingText.textContent = text;
    this.loading.classList.remove('hidden');
  }

  hideLoading() {
    if (this.loading) {
      this.loading.classList.add('hidden');
    }
  }

  /**
   * Initializes state and controls for the dynamic Web Audio toggle.
   */
  initAudioToggle() {
    if (!this.audioBtn) return;
    
    // Set initial state icon based on saved preference
    const saved = localStorage.getItem('sticky-fight-sound');
    if (saved === 'true') {
      this.audioBtn.querySelector('.icon').textContent = '🔊';
    } else {
      this.audioBtn.querySelector('.icon').textContent = '🔇';
    }

    this.audioBtn.addEventListener('click', () => {
      const isEnabled = window.audio.toggle();
      this.audioBtn.querySelector('.icon').textContent = isEnabled ? '🔊' : '🔇';
      this.showToast(isEnabled ? 'Ovoz yoqildi!' : 'Ovoz o\'chirildi!');
    });
  }

  /**
   * Responsive scaling handler for HTML5 Canvas.
   * Keeps game width/height aspect ratio matches to virtual 800x500 box.
   */
  initCanvasAutoResizer() {
    const canvas = document.getElementById('battle-canvas');
    if (!canvas) return;

    const resize = () => {
      const wrapper = canvas.parentElement;
      if (!wrapper) return;

      const containerWidth = window.innerWidth * 0.95;
      // Subtract HUD and margin heights
      const containerHeight = window.innerHeight - 250; 
      
      const aspect = this.gameWidth / this.gameHeight;
      
      let newWidth = containerWidth;
      let newHeight = containerWidth / aspect;

      if (newHeight > containerHeight) {
        newHeight = containerHeight;
        newWidth = containerHeight * aspect;
      }

      // Clamp new sizes
      newWidth = Math.min(newWidth, this.gameWidth);
      newHeight = Math.min(newHeight, this.gameHeight);

      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
    };

    window.addEventListener('resize', resize);
    // Trigger initial scale
    setTimeout(resize, 100);
  }

  /**
   * Updates Battle Arena HUD Health bars.
   */
  updateHpBar(playerNum, hp, maxHp) {
    const bar = document.getElementById(`hud-p${playerNum}-hp`);
    const txt = document.getElementById(`hud-p${playerNum}-hp-text`);
    if (!bar || !txt) return;

    const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
    bar.style.width = `${pct}%`;
    txt.textContent = `${pct}%`;

    // Visual indicators based on health thresholds
    bar.classList.remove('mid', 'low');
    if (pct < 30) {
      bar.classList.add('low');
    } else if (pct < 60) {
      bar.classList.add('mid');
    }
  }

  /**
   * Updates round wins score count visual indicator dots.
   */
  updateRoundScores(p1Score, p2Score) {
    const p1Dots = document.getElementById('hud-p1-rounds').querySelectorAll('.dot');
    const p2Dots = document.getElementById('hud-p2-rounds').querySelectorAll('.dot');

    p1Dots.forEach((dot, idx) => {
      if (idx < p1Score) dot.classList.add('won');
      else dot.classList.remove('won');
    });

    p2Dots.forEach((dot, idx) => {
      if (idx < p2Score) dot.classList.add('won');
      else dot.classList.remove('won');
    });
  }

  /**
   * Displays Combo popups on canvas HUD.
   */
  triggerComboIndicator(playerNum, count) {
    const meter = document.getElementById(`combo-meter-p${playerNum}`);
    if (!meter) return;

    if (count >= 2) {
      meter.textContent = `Combo x${count}!`;
      meter.classList.remove('hidden');
      
      if (this[`comboTimeoutP${playerNum}`]) clearTimeout(this[`comboTimeoutP${playerNum}`]);
      
      this[`comboTimeoutP${playerNum}`] = setTimeout(() => {
        meter.classList.add('hidden');
      }, 1000);
    } else {
      meter.classList.add('hidden');
    }
  }
}

// Global single instance export
window.ui = new UIManager();
