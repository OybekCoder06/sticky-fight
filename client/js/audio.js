/**
 * Web Audio API Sound Synthesizer for sticky-fight
 * Generates all game sound effects programmatically.
 */

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    // Attempt to load preference
    const saved = localStorage.getItem('sticky-fight-sound');
    this.enabled = saved === 'true'; // Default to false until clicked
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      console.log('[AudioSynth] Web Audio initialized.');
    } catch (e) {
      console.warn('Web Audio API is not supported in this browser.', e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('sticky-fight-sound', this.enabled);
    if (this.enabled) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.playTone(440, 'sine', 0.1, 0.05); // test click beep
    }
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.2, volume = 0.1) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /**
   * Sound of sword swinging (noise sweep)
   */
  playSwish() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Fill buffer with noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter sweeps from high to low to sound like swoosh
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.15);
  }

  /**
   * Wood sword hit impact sound (thud + pitch drop)
   */
  playHit() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Low punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(now + 0.12);

    // Crack sound (high pass noise)
    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, now);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    
    noise.start();
    noise.stop(now + 0.05);
  }

  /**
   * Sword block sound (metallic-like wood click)
   */
  playBlock() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Two high-pitched oscillators to simulate clashing
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1800, now);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.1);
    osc2.stop(now + 0.1);
  }

  /**
   * Match victory melody (major scale ascending chords)
   */
  playVictory() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const durations = [0.15, 0.15, 0.15, 0.4];
    const deltas = [0, 0.12, 0.24, 0.36];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + deltas[i]);
      
      gain.gain.setValueAtTime(0, now + deltas[i]);
      gain.gain.linearRampToValueAtTime(0.2, now + deltas[i] + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + deltas[i] + durations[i]);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + deltas[i]);
      osc.stop(now + deltas[i] + durations[i]);
    });
  }

  /**
   * Match defeat melody (descending minor sequence)
   */
  playDefeat() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [311.13, 293.66, 261.63, 220.00]; // Eb4, D4, C4, A3
    const durations = [0.2, 0.2, 0.2, 0.5];
    const deltas = [0, 0.18, 0.36, 0.54];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + deltas[i]);
      
      gain.gain.setValueAtTime(0, now + deltas[i]);
      gain.gain.linearRampToValueAtTime(0.12, now + deltas[i] + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + deltas[i] + durations[i]);
      
      // Filter out high buzz to sound a bit retro/melancholic
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + deltas[i]);
      osc.stop(now + deltas[i] + durations[i]);
    });
  }
}

// Global single instance export
window.audio = new AudioSynth();
