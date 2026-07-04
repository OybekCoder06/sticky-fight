/**
 * Bot AI Controller for Single Player Mode
 * Implements a modular state machine adjusting reaction times, attack triggers and blocking percentages.
 */

class BotAI {
  constructor(difficulty, color) {
    this.difficulty = difficulty;
    this.color = color;

    // AI parameters based on selected difficulty
    const profiles = {
      easy: {
        reactionTime: 1200,      // latency in milliseconds to react to player actions
        attackCooldown: 1600,     // time between consecutive strikes
        blockChance: 0.20,       // probability to successfully block a player swing
        retreatChance: 0.10,     // probability to step back and re-evaluate
        comboChance: 0.05        // chance to stack strikes
      },
      normal: {
        reactionTime: 300,
        attackCooldown: 800,
        blockChance: 0.40,
        retreatChance: 0.15,
        comboChance: 0.30
      },
      hard: {
        reactionTime: 80,
        attackCooldown: 320,
        blockChance: 0.92,
        retreatChance: 0.05,
        comboChance: 0.85
      }
    };

    this.profile = profiles[difficulty] || profiles.normal;

    // AI internal state registers
    this.lastDecisionTime = 0;
    this.lastAttackTime = 0;
    this.state = 'chase'; // 'chase', 'combat', 'block', 'retreat'
    this.stateTimer = 0;

    // Virtual outputs mimicking a real keyboard controller
    this.inputs = {
      left: false,
      right: false,
      attack: false,
      block: false
    };

    // Tracks if bot is currently responding to a player's active swing
    this.reactiveBlockTriggered = false;
    this.blockTriggerTime = 0;
    this.comboAttackTime = 0;
  }

  /**
   * Resets AI state parameters between rounds.
   */
  reset() {
    this.state = 'chase';
    this.stateTimer = 0;
    this.inputs = { left: false, right: false, attack: false, block: false };
    this.reactiveBlockTriggered = false;
    this.blockTriggerTime = 0;
    this.comboAttackTime = 0;
  }

  /**
   * Evaluates combat spatial relationships and returns simulated keyboard inputs.
   * @param {Object} bot - bot character details (x, y, hp, action)
   * @param {Object} player - player character details (x, y, hp, action, actionTimer)
   * @param {number} time - current game timestamp
   */
  update(bot, player, time) {
    // Reset momentary inputs
    this.inputs.attack = false;

    // Check combo queue
    if (this.comboAttackTime && time >= this.comboAttackTime) {
      this.inputs.attack = true;
      this.comboAttackTime = 0;
      this.lastAttackTime = time;
    }

    // If bot is stunned or dead, release movement controls and clear queued actions
    if (bot.action === 'hit_reaction' || bot.action === 'death' || bot.hp <= 0) {
      this.inputs.left = false;
      this.inputs.right = false;
      this.inputs.block = false;
      this.blockTriggerTime = 0;
      this.comboAttackTime = 0;
      return this.inputs;
    }

    const distance = Math.abs(bot.x - player.x);
    const swordReach = 90; // comfortable distance to connect a wooden sword swing

    // 1. REACTIVE DEFENSE SYSTEM
    // Check if the player is currently mid-strike
    if (player.action === 'attack' && !this.reactiveBlockTriggered) {
      this.reactiveBlockTriggered = true;
      this.blockTriggerTime = time + this.profile.reactionTime;
    }

    // Reset defense trigger once player is no longer swinging
    if (player.action !== 'attack') {
      this.reactiveBlockTriggered = false;
      this.blockTriggerTime = 0;
    }

    // Process queued block response
    if (this.blockTriggerTime && time >= this.blockTriggerTime) {
      this.blockTriggerTime = 0;
      if (bot.action !== 'hit_reaction' && bot.action !== 'death' && bot.hp > 0) {
        const checkRoll = Math.random();
        if (checkRoll < this.profile.blockChance) {
          this.state = 'block';
          this.inputs.block = true;
          this.inputs.left = false;
          this.inputs.right = false;
          // Lock block stance for 400ms
          this.stateTimer = time + 400; 
        }
      }
    }

    // Skip state machine shifts if locked in a block stance
    if (this.state === 'block') {
      if (time > this.stateTimer) {
        this.inputs.block = false;
        this.state = 'chase';
      } else {
        return this.inputs;
      }
    }

    // Skip state changes if locked in a retreat cycle
    if (this.state === 'retreat') {
      if (time > this.stateTimer) {
        this.inputs.left = false;
        this.inputs.right = false;
        this.state = 'chase';
      } else {
        // Move away from player
        if (bot.x < player.x) {
          this.inputs.left = true;
          this.inputs.right = false;
        } else {
          this.inputs.left = false;
          this.inputs.right = true;
        }
        return this.inputs;
      }
    }

    // 2. TACTICAL BRAIN DECISIONS (rate limited to simulate latency)
    if (time - this.lastDecisionTime > 150) {
      this.lastDecisionTime = time;

      if (distance > swordReach) {
        // Chase player
        this.state = 'chase';
        this.inputs.block = false;
        if (bot.x < player.x) {
          this.inputs.right = true;
          this.inputs.left = false;
        } else {
          this.inputs.left = true;
          this.inputs.right = false;
        }
      } else {
        // Combat range reached
        this.state = 'combat';
        this.inputs.left = false;
        this.inputs.right = false;

        // Perform random retreat check
        if (Math.random() < this.profile.retreatChance) {
          this.state = 'retreat';
          this.stateTimer = time + Math.floor(250 + Math.random() * 200); // retreat duration
          return this.inputs;
        }

        // Trigger sword attacks
        const attackWait = this.profile.attackCooldown;
        if (time - this.lastAttackTime > attackWait) {
          this.inputs.attack = true;
          this.lastAttackTime = time;
          
          // Small chance to initiate secondary combo trigger (on Hard/Normal)
          if (Math.random() < this.profile.comboChance) {
            this.comboAttackTime = time + 320;
          }
        }
      }
    }

    return this.inputs;
  }
}

// Export BotAI class
window.BotAI = BotAI;
