/**
 * Procedural Stickman Renderer and Animator for sticky-fight
 * Draws stickman figures and wooden swords using mathematical coordinate transformations.
 * Supports jumping postures, 3-phase slashes, blocks with recoil shake,
 * hit-reddening, knockdown, victory, collapse death (with dropping sword),
 * and critical shatter explosions.
 */

class Stickman {
  constructor(color, isFacingRight) {
    this.color = color;
    this.direction = isFacingRight ? 1 : -1;
    this.x = 0;
    this.y = 0;
    this.action = 'idle';
    this.actionTimer = 0; // locked animation timer
    this.maxActionTimer = 0;
    this.hp = 100;
    this.maxHp = 100;

    // Color definitions (exact HEX codes from design references)
    this.colors = {
      green: '#66CC00',
      yellow: '#FEC503',
      blue: '#33CCFF',
      red: '#D81000'
    };
    this.glowColors = {
      green: 'rgba(102, 204, 0, 0.4)',
      yellow: 'rgba(254, 197, 3, 0.4)',
      blue: 'rgba(51, 204, 255, 0.4)',
      red: 'rgba(216, 16, 0, 0.4)'
    };

    this.boneColor = this.colors[color] || '#ffffff';
    this.glowColor = this.glowColors[color] || 'rgba(255,255,255,0.2)';

    // Recoil block variables
    this.blockRecoilTime = 0;

    // Dropped sword physics (Variant A death)
    this.swordDropped = false;
    this.droppedSword = null;

    // Shattered bones parts (Variant C death)
    this.isShattered = false;
    this.shatteredParts = [];
    this.opacity = 1.0;
  }

  /**
   * Resets the stickman's visual, animation, and combat states.
   */
  resetState() {
    this.action = 'idle';
    this.actionTimer = 0;
    this.maxActionTimer = 0;
    this.blockRecoilTime = 0;
    this.swordDropped = false;
    this.droppedSword = null;
    this.isShattered = false;
    this.shatteredParts = [];
    this.opacity = 1.0;
    this.combo = 0;
    this.lastHitTime = 0;
    this.trailHistory = [];
  }

  /**
   * Updates state from server data (in multiplayer) or client simulation.
   */
  update(x, y, hp, action, direction, actionTimer, maxActionTimer) {
    // Translate death to shatter on client for critical finish flavor in multiplayer
    if (this.action !== 'death' && this.action !== 'shatter' && action === 'death') {
      const isCriticalFinish = this.combo >= 2 || Math.random() < 0.35;
      if (isCriticalFinish) {
        action = 'shatter';
      }
    }

    // If we transition to a new action, set the correct maxActionTimer locally
    if (this.action !== action) {
      if (action === 'death') {
        this.swordDropped = false;
      }
      if (action === 'shatter') {
        this.isShattered = false;
        this.shatteredParts = [];
      }
      if (action !== 'death' && action !== 'shatter') {
        this.isShattered = false;
        this.shatteredParts = [];
        this.opacity = 1.0;
        this.swordDropped = false;
        this.droppedSword = null;
      }
      
      // Determine maxActionTimer locally to prevent scaling bugs
      if (action === 'attack') {
        this.maxActionTimer = this.color === 'red' ? 380 : 450;
      } else if (action === 'hit_reaction') {
        this.maxActionTimer = 220;
      } else if (action === 'knockdown') {
        this.maxActionTimer = 1500;
      } else if (action === 'death') {
        this.maxActionTimer = 1000;
      } else {
        this.maxActionTimer = 300;
      }

      // Initialize actionTimer locally for the new action if not provided by server
      if (actionTimer === undefined || actionTimer === null) {
        this.actionTimer = this.maxActionTimer;
      }
    }

    // Just in case, ensure maxActionTimer is initialized correctly on startup or when bad inputs are passed
    if (!this.maxActionTimer || this.maxActionTimer <= 0 || this.maxActionTimer === 100 || this.maxActionTimer === 115) {
      if (action === 'attack') {
        this.maxActionTimer = this.color === 'red' ? 380 : 450;
      } else if (action === 'hit_reaction') {
        this.maxActionTimer = 220;
      } else if (action === 'knockdown') {
        this.maxActionTimer = 1500;
      } else if (action === 'death') {
        this.maxActionTimer = 1000;
      } else {
        this.maxActionTimer = 300;
      }
    }

    this.x = x;
    this.y = y;
    this.hp = hp;
    this.action = action;
    this.direction = direction;
    
    if (actionTimer !== undefined && actionTimer !== null) {
      this.actionTimer = actionTimer;
    } else if (this.actionTimer === undefined || this.actionTimer === null || isNaN(this.actionTimer)) {
      this.actionTimer = this.maxActionTimer;
    }
  }

  /**
   * Interpolates hex colors towards red based on damage ratio.
   */
  getDynamicColor() {
    const baseHex = this.boneColor;
    
    // Quick red flash on hit reaction
    if (this.action === 'hit_reaction') {
      return '#ff3333';
    }

    if (this.hp >= this.maxHp) return baseHex;
    
    // Factor of redness based on damage
    const factor = 1 - Math.max(0, this.hp / this.maxHp);
    
    // Convert base hex to rgb
    const r1 = parseInt(baseHex.slice(1, 3), 16);
    const g1 = parseInt(baseHex.slice(3, 5), 16);
    const b1 = parseInt(baseHex.slice(5, 7), 16);
    
    // Red color: rgb(255, 51, 51)
    const r2 = 255;
    const g2 = 51;
    const b2 = 51;
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Main draw command.
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} time - current game loop timestamp
   */
  draw(ctx, time) {
    // If the stickman is shattered (Variant C), draw explosive parts instead of hierarchy
    if (this.action === 'shatter' || this.isShattered) {
      this.drawShatteredBones(ctx);
      return;
    }

    ctx.save();

    // Configure line style for skeletal bones
    ctx.lineWidth = 9; // limb default width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Get dynamic bone color based on health status
    const currentBoneColor = this.getDynamicColor();
    ctx.strokeStyle = currentBoneColor;
    ctx.fillStyle = currentBoneColor;

    // Flat design style: no glow shadows
    ctx.shadowBlur = 0;

    // Determine displacements
    let bounceY = 0;
    let headTilt = 0;
    let spineTilt = 0.05 * this.direction; // slight forward lean
    let leftArmAngle = 0.4;
    let rightArmAngle = -0.4;
    let leftLegAngle = 0;
    let rightLegAngle = 0;

    // Block recoil offset shake
    let recoilX = 0;
    if (this.action === 'block' && this.blockRecoilTime > 0) {
      recoilX = Math.sin(this.blockRecoilTime * 1.5) * 4 * this.direction;
      this.blockRecoilTime--;
    }

    // Joint offsets relative to base player coordinates
    const headRadius = 9.5; // Torso width 12 * 1.5 ratio / 2 radius = 9 to 9.5
    const torsoLen = 45;
    const limbLen = 22;

    const phase = time / 120; // animation walk speed multiplier

    // Draw parameters based on state
    switch (this.action) {
      case 'idle':
        // Breathing sinusoidal loop
        bounceY = Math.sin(time / 240) * 1.8;
        headTilt = Math.sin(time / 480) * 0.04;
        
        // Stance: slightly bent knees and hands ready
        leftArmAngle = Math.PI / 4 + Math.sin(time / 240) * 0.04; 
        rightArmAngle = -Math.PI / 4 - Math.sin(time / 240) * 0.04;
        leftLegAngle = 0.15;
        rightLegAngle = -0.15;
        break;

      case 'move_forward':
        // Leg walk cycles and head bobbing
        bounceY = Math.abs(Math.sin(phase)) * -3.5;
        spineTilt = 0.12 * this.direction;
        headTilt = 0.08 * this.direction;
        
        leftLegAngle = Math.sin(phase) * 0.5;
        rightLegAngle = -Math.sin(phase) * 0.5;
        leftArmAngle = Math.PI / 4 - Math.sin(phase) * 0.3;
        rightArmAngle = -Math.PI / 4 + Math.sin(phase) * 0.3;
        break;

      case 'move_back':
        bounceY = Math.abs(Math.sin(phase)) * -2.5;
        spineTilt = -0.06 * this.direction; // lean backward slightly
        
        leftLegAngle = -Math.sin(phase) * 0.45;
        rightLegAngle = Math.sin(phase) * 0.45;
        leftArmAngle = Math.PI / 4 + Math.sin(phase) * 0.25;
        rightArmAngle = -Math.PI / 4 - Math.sin(phase) * 0.25;
        break;

      case 'jump':
        // Jumping skeletal posture: knees bent upward, arms extended
        bounceY = -4;
        spineTilt = 0.08 * this.direction;
        leftLegAngle = 0.5;
        rightLegAngle = -0.4;
        leftArmAngle = Math.PI / 2;
        rightArmAngle = -Math.PI / 2;
        break;

      case 'attack':
        // 3-Phase procedural slash animation model
        // actionTimer goes from max duration down to 0
        const progress = 1 - (this.actionTimer / this.maxActionTimer);
        
        if (progress < 0.40) {
          // 1. WINDUP Phase (0.0 to 0.40): Pull sword back and lean torso back
          const windupPct = progress / 0.40;
          spineTilt = -0.15 * windupPct * this.direction;
          bounceY = windupPct * 1.5;
          rightArmAngle = this.direction * (-Math.PI * 0.75 * windupPct);
          leftArmAngle = Math.PI / 5;
          leftLegAngle = 0.2;
          rightLegAngle = -0.2;
        } else if (progress < 0.65) {
          // 2. STRIKE Phase (0.40 to 0.65): Heavy forward leap slash
          const strikePct = (progress - 0.40) / 0.25;
          spineTilt = (-0.15 + strikePct * 0.45) * this.direction;
          bounceY = -3 + strikePct * 4;
          rightArmAngle = this.direction * (-Math.PI * 0.75 + strikePct * Math.PI * 1.15);
          leftArmAngle = Math.PI / 5 + strikePct * 0.2;
          leftLegAngle = 0.3;
          rightLegAngle = -0.4;
        } else {
          // 3. RECOVER Phase (0.65 to 1.0): Reset stance
          const recoverPct = (progress - 0.65) / 0.35;
          spineTilt = (0.30 - recoverPct * 0.25) * this.direction;
          bounceY = 1 - recoverPct * 1;
          rightArmAngle = this.direction * (Math.PI * 0.40 - recoverPct * Math.PI * 0.80);
          leftArmAngle = Math.PI / 4;
          leftLegAngle = 0.2 - recoverPct * 0.05;
          rightLegAngle = -0.3 + recoverPct * 0.15;
        }
        break;

      case 'block':
        // Sturdy crouched posture with defensive guard raised
        spineTilt = -0.1 * this.direction;
        bounceY = 3.5; // crouch
        leftLegAngle = 0.35;
        rightLegAngle = -0.35;
        
        rightArmAngle = this.direction * (-Math.PI * 0.28);
        leftArmAngle = Math.PI / 3;
        break;

      case 'hit_reaction':
        // Recoil displacement
        spineTilt = -0.35 * this.direction;
        headTilt = -0.25 * this.direction;
        bounceY = -5; // fly back
        
        rightArmAngle = this.direction * -Math.PI * 0.75;
        leftArmAngle = this.direction * Math.PI * 0.75;
        leftLegAngle = -0.35;
        rightLegAngle = 0.25;
        break;

      case 'knockdown':
        // Knockdown states transition:
        // actionTimer goes from 1500ms down to 0
        const kdProgress = 1 - (this.actionTimer / 1500);

        if (kdProgress < 0.20) {
          // Phase 1: Stumble and fly back (0 to 300ms)
          const fallPct = kdProgress / 0.20;
          bounceY = fallPct * 30; // drop down
          spineTilt = this.direction * (-Math.PI * 0.35 * fallPct);
          headTilt = this.direction * (-Math.PI * 0.15 * fallPct);
          
          rightArmAngle = this.direction * (-Math.PI * 0.7 * (1 - fallPct) + Math.PI * 0.4 * fallPct);
          leftArmAngle = this.direction * (Math.PI * 0.7 * (1 - fallPct) - Math.PI * 0.3 * fallPct);
          leftLegAngle = -Math.PI * 0.25 * fallPct;
          rightLegAngle = -Math.PI * 0.3 * fallPct;
        } else if (kdProgress < 0.70) {
          // Phase 2: Laying flat on ground (300 to 1050ms)
          bounceY = 38; // flat on floor
          spineTilt = this.direction * (-Math.PI * 0.48); // horizontal
          headTilt = this.direction * (-Math.PI * 0.02);
          
          rightArmAngle = this.direction * Math.PI * 0.45;
          leftArmAngle = this.direction * -Math.PI * 0.35;
          leftLegAngle = -Math.PI * 0.4;
          rightLegAngle = -Math.PI * 0.45;
        } else {
          // Phase 3: Slowly sit up and stand back up (1050 to 1500ms)
          const upPct = (kdProgress - 0.70) / 0.30;
          bounceY = 38 * (1 - upPct);
          spineTilt = this.direction * (-Math.PI * 0.48 * (1 - upPct) + 0.05 * upPct);
          headTilt = this.direction * (-Math.PI * 0.02 * (1 - upPct));
          
          rightArmAngle = this.direction * (Math.PI * 0.45 * (1 - upPct) - Math.PI * 0.25 * upPct);
          leftArmAngle = this.direction * (-Math.PI * 0.35 * (1 - upPct) + Math.PI * 0.25 * upPct);
          leftLegAngle = -Math.PI * 0.4 * (1 - upPct) + 0.1 * upPct;
          rightLegAngle = -Math.PI * 0.45 * (1 - upPct) - 0.1 * upPct;
        }
        break;

      case 'death':
        // Variant A collapse: drop down, slide to knees and fade out
        const deathProgress = Math.min(1, 1 - (this.actionTimer / 1000));
        this.opacity = 1 - deathProgress; // fade out

        bounceY = deathProgress * 30; // knees drop
        spineTilt = this.direction * (-Math.PI * 0.35 * deathProgress);
        headTilt = this.direction * (Math.PI * 0.25 * deathProgress);
        
        leftLegAngle = -Math.PI * 0.35 * deathProgress;
        rightLegAngle = -Math.PI * 0.35 * deathProgress;
        
        // Arms collapse down
        rightArmAngle = this.direction * (Math.PI * 0.4 * deathProgress);
        leftArmAngle = this.direction * (Math.PI * 0.25 * deathProgress);
        break;
    }

    // --- CALCULATE KEY JOINTS COORDINATES ---
    const hipY = this.y - 48 + bounceY;
    const hipX = this.x + recoilX;

    const pelvis = { x: hipX, y: hipY };

    const neckX = pelvis.x - Math.sin(spineTilt) * torsoLen;
    const neckY = pelvis.y - Math.cos(spineTilt) * torsoLen;
    const neck = { x: neckX, y: neckY };

    const headX = neck.x - Math.sin(spineTilt + headTilt) * (headRadius + 2);
    const headY = neck.y - Math.cos(spineTilt + headTilt) * (headRadius + 2);
    const head = { x: headX, y: headY };

    const shoulder = { x: neck.x, y: neck.y + 4 };

    // --- DRAW SKELETON ---
    ctx.globalAlpha = this.opacity;

    // 1. Draw head (circle) - fully filled circle, flat color, no borders or face details
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw torso/spine (thicker than limbs: 12px)
    ctx.save();
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(neck.x, neck.y);
    ctx.lineTo(pelvis.x, pelvis.y);
    ctx.stroke();
    ctx.restore();

    // Restore standard limb thickness
    ctx.lineWidth = 9;

    // 3. Draw Back Leg
    const backLegAngle = this.direction === 1 ? leftLegAngle : rightLegAngle;
    const backKneeX = pelvis.x - Math.sin(backLegAngle + 0.2 * this.direction) * limbLen;
    const backKneeY = pelvis.y + Math.cos(backLegAngle + 0.2 * this.direction) * limbLen;
    
    const backFootX = backKneeX - Math.sin(backLegAngle - 0.1 * this.direction) * limbLen;
    let backFootY = backKneeY + Math.cos(backLegAngle - 0.1 * this.direction) * limbLen;
    if (!['death', 'knockdown'].includes(this.action) && backFootY > this.y) backFootY = this.y;

    ctx.beginPath();
    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(backKneeX, backKneeY);
    ctx.lineTo(backFootX, backFootY);
    ctx.stroke();

    // 4. Draw Front Leg
    const frontLegAngle = this.direction === 1 ? rightLegAngle : leftLegAngle;
    const frontKneeX = pelvis.x - Math.sin(frontLegAngle - 0.2 * this.direction) * limbLen;
    const frontKneeY = pelvis.y + Math.cos(frontLegAngle - 0.2 * this.direction) * limbLen;
    
    let frontFootX = frontKneeX - Math.sin(frontLegAngle + 0.1 * this.direction) * limbLen;
    let frontFootY = frontKneeY + Math.cos(frontLegAngle + 0.1 * this.direction) * limbLen;
    if (!['death', 'knockdown'].includes(this.action) && frontFootY > this.y) frontFootY = this.y;

    ctx.beginPath();
    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(frontKneeX, frontKneeY);
    ctx.lineTo(frontFootX, frontFootY);
    ctx.stroke();

    // 5. Draw Back Arm
    const backArmAngle = this.direction === 1 ? leftArmAngle : rightArmAngle;
    const backElbowX = shoulder.x - Math.sin(backArmAngle + 0.4 * this.direction) * limbLen;
    const backElbowY = shoulder.y + Math.cos(backArmAngle + 0.4 * this.direction) * limbLen;
    const backHandX = backElbowX - Math.sin(backArmAngle - 0.2 * this.direction) * limbLen;
    const backHandY = backElbowY + Math.cos(backArmAngle - 0.2 * this.direction) * limbLen;

    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(backElbowX, backElbowY);
    ctx.lineTo(backHandX, backHandY);
    ctx.stroke();

    // 6. Draw Front Arm
    const frontArmAngle = this.direction === 1 ? rightArmAngle : leftArmAngle;
    const frontElbowX = shoulder.x - Math.sin(frontArmAngle - 0.4 * this.direction) * limbLen;
    const frontElbowY = shoulder.y + Math.cos(frontArmAngle - 0.4 * this.direction) * limbLen;
    const frontHandX = frontElbowX - Math.sin(frontArmAngle + 0.2 * this.direction) * limbLen;
    const frontHandY = frontElbowY + Math.cos(frontArmAngle + 0.2 * this.direction) * limbLen;

    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(frontElbowX, frontElbowY);
    ctx.lineTo(frontHandX, frontHandY);
    ctx.stroke();

    // 7. Draw the WOODEN SWORD
    if (this.action === 'death') {
      // Variant A: sword drops out of hand and falls onto floor
      if (!this.swordDropped) {
        this.swordDropped = true;
        this.droppedSword = {
          x: frontHandX,
          y: frontHandY,
          angle: frontArmAngle + (0.5 * this.direction),
          vx: -this.direction * (1 + Math.random() * 2),
          vy: -3 - Math.random() * 2,
          va: (Math.random() - 0.5) * 0.3
        };
      }
      this.updateAndDrawDroppedSword(ctx);
    } else {
      // Normal attached sword rotation checks
      let swordAngle = frontArmAngle + (0.5 * this.direction);
      if (this.action === 'block') {
        swordAngle = -0.55 * this.direction;
      } else if (this.action === 'attack') {
        const p = 1 - (this.actionTimer / this.maxActionTimer);
        if (p < 0.40) {
          // Windup: sword held back
          swordAngle = frontArmAngle - (0.45 * this.direction);
        } else if (p < 0.65) {
          // Strike: sword swings in arc
          const strikeP = (p - 0.40) / 0.25;
          swordAngle = frontArmAngle + ((0.5 - strikeP * 0.9) * this.direction);
        } else {
          // Recover: sword resets
          const recoverP = (p - 0.65) / 0.35;
          swordAngle = frontArmAngle + ((-0.4 + recoverP * 0.9) * this.direction);
        }
      } else if (this.action === 'knockdown') {
        swordAngle = Math.PI * 0.3 * this.direction;
      }
      this.drawWoodenSword(ctx, frontHandX, frontHandY, swordAngle);
      
      // Store current sword tip coordinate for motion trail checks in battle.js
      this.swordTipX = frontHandX - Math.sin(swordAngle) * 70;
      this.swordTipY = frontHandY - Math.cos(swordAngle) * 70;
    }

    ctx.restore();
  }

  /**
   * Drops the wooden sword separately on the ground plane.
   */
  updateAndDrawDroppedSword(ctx) {
    if (!this.droppedSword) return;

    // Apply gravity
    this.droppedSword.vy += 0.2;
    this.droppedSword.x += this.droppedSword.vx;
    this.droppedSword.y += this.droppedSword.vy;
    this.droppedSword.angle += this.droppedSword.va;

    // Ground bounce plane
    if (this.droppedSword.y > 400) {
      this.droppedSword.y = 400;
      this.droppedSword.vy = -this.droppedSword.vy * 0.35; // bounce bounce
      this.droppedSword.vx *= 0.5; // friction
      this.droppedSword.va *= 0.4;
    }

    this.drawWoodenSword(ctx, this.droppedSword.x, this.droppedSword.y, this.droppedSword.angle);
  }

  /**
   * Draws a wooden sword.
   */
  drawWoodenSword(ctx, x, y, angle) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(x, y);
    ctx.rotate(angle);

    const woodMain = '#8B5A2B';
    const woodShadow = '#5C3A1E';
    const woodHighlight = '#b08253';

    const swordLength = 70;
    const bladeWidth = 6;
    const hiltLength = 12;

    // Draw hilt
    ctx.fillStyle = '#4a321e';
    ctx.beginPath();
    ctx.roundRect(-bladeWidth/2, -hiltLength, bladeWidth, hiltLength, 2);
    ctx.fill();

    // Draw cross-guard
    ctx.fillStyle = '#2d1b0d';
    ctx.fillRect(-bladeWidth - 2, -hiltLength, bladeWidth * 2 + 4, 3);

    // Draw blade
    ctx.fillStyle = woodMain;
    ctx.beginPath();
    ctx.moveTo(-bladeWidth/2, -hiltLength - 3);
    ctx.lineTo(-bladeWidth/2, -swordLength + 5);
    ctx.quadraticCurveTo(0, -swordLength, bladeWidth/2, -swordLength + 5);
    ctx.lineTo(bladeWidth/2, -hiltLength - 3);
    ctx.closePath();
    ctx.fill();

    // Draw texture shadow side
    ctx.fillStyle = woodShadow;
    ctx.beginPath();
    ctx.moveTo(-bladeWidth/2, -hiltLength - 3);
    ctx.lineTo(-bladeWidth/2, -swordLength + 5);
    ctx.quadraticCurveTo(-bladeWidth/4, -swordLength + 1, 0, -swordLength + 2);
    ctx.lineTo(0, -hiltLength - 3);
    ctx.closePath();
    ctx.fill();

    // Draw highlight
    ctx.strokeStyle = woodHighlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bladeWidth/4, -hiltLength - 3);
    ctx.lineTo(bladeWidth/4, -swordLength + 8);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Initializes explosive bone elements for the Critical Shatter (Variant C) defeat style.
   */
  initShatterParts() {
    this.isShattered = true;
    this.shatteredParts = [];

    // Stance vectors matching default idle
    const headRadius = 9.5;
    const torsoLen = 45;
    const limbLen = 22;

    const hipY = this.y - 48;
    const hipX = this.x;
    const pelvis = { x: hipX, y: hipY };
    
    const neck = { x: pelvis.x, y: pelvis.y - torsoLen };
    const head = { x: neck.x, y: neck.y - headRadius - 2 };
    
    // Deconstruct head
    this.shatteredParts.push({
      type: 'head',
      x: head.x,
      y: head.y,
      r: headRadius,
      vx: (Math.random() - 0.5) * 8,
      vy: -4 - Math.random() * 6,
      va: (Math.random() - 0.5) * 0.15
    });

    // Deconstruct torso (torso width is 12)
    this.shatteredParts.push({
      type: 'line',
      width: 12,
      x1: neck.x, y1: neck.y, x2: pelvis.x, y2: pelvis.y,
      vx: (Math.random() - 0.5) * 6,
      vy: -3 - Math.random() * 5,
      va: (Math.random() - 0.5) * 0.08
    });

    // Deconstruct back arm (Left shoulder -> elbow -> hand)
    const s = { x: neck.x, y: neck.y + 4 };
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: s.x, y1: s.y, x2: s.x - 10, y2: s.y + 18,
      vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 5, va: (Math.random() - 0.5) * 0.1
    });
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: s.x - 10, y1: s.y + 18, x2: s.x - 18, y2: s.y + 35,
      vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 4, va: (Math.random() - 0.5) * 0.12
    });

    // Deconstruct front arm (Right shoulder -> elbow -> hand)
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: s.x, y1: s.y, x2: s.x + 10, y2: s.y + 18,
      vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 5, va: (Math.random() - 0.5) * 0.1
    });
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: s.x + 10, y1: s.y + 18, x2: s.x + 18, y2: s.y + 35,
      vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 4, va: (Math.random() - 0.5) * 0.12
    });

    // Deconstruct legs
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: pelvis.x, y1: pelvis.y, x2: pelvis.x - 12, y2: pelvis.y + 20,
      vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, va: (Math.random() - 0.5) * 0.08
    });
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: pelvis.x - 12, y1: pelvis.y + 20, x2: pelvis.x - 18, y2: pelvis.y + 40,
      vx: (Math.random() - 0.5) * 6, vy: -1 - Math.random() * 3, va: (Math.random() - 0.5) * 0.1
    });

    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: pelvis.x, y1: pelvis.y, x2: pelvis.x + 12, y2: pelvis.y + 20,
      vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, va: (Math.random() - 0.5) * 0.08
    });
    this.shatteredParts.push({
      type: 'line',
      width: 9,
      x1: pelvis.x + 12, y1: pelvis.y + 20, x2: pelvis.x + 18, y2: pelvis.y + 40,
      vx: (Math.random() - 0.5) * 6, vy: -1 - Math.random() * 3, va: (Math.random() - 0.5) * 0.1
    });

    // Deconstruct sword
    this.shatteredParts.push({
      type: 'sword',
      x: s.x + 18,
      y: s.y + 35,
      angle: 0.8 * this.direction,
      vx: -this.direction * (2 + Math.random() * 3),
      vy: -4 - Math.random() * 3,
      va: (Math.random() - 0.5) * 0.25
    });
  }

  /**
   * Draws and updates physics calculations for explosive bone parts.
   */
  drawShatteredBones(ctx) {
    if (this.shatteredParts.length === 0) {
      this.initShatterParts();
    }

    ctx.save();
    
    // Decrement global opacity
    this.opacity = Math.max(0, this.opacity - 0.015);
    ctx.globalAlpha = this.opacity;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.boneColor;
    ctx.fillStyle = this.boneColor;
    ctx.shadowBlur = 0; // Flat design: no shadow/glow

    this.shatteredParts.forEach(p => {
      // Apply gravity
      p.vy += 0.22;
      
      // Update coordinates
      if (p.type === 'head') {
        p.x += p.vx;
        p.y += p.vy;
        
        // Bounce on floor
        if (p.y > 400) { p.y = 400; p.vy = -p.vy * 0.4; p.vx *= 0.6; }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'line') {
        // Find mid point and translate/rotate to simulate rotating segment
        const mx = (p.x1 + p.x2) / 2 + p.vx;
        const my = (p.y1 + p.y2) / 2 + p.vy;
        
        // Re-adjust endpoints
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const currentAngle = Math.atan2(dy, dx) + p.va;
        
        p.x1 = mx - Math.cos(currentAngle) * (len / 2);
        p.y1 = my - Math.sin(currentAngle) * (len / 2);
        p.x2 = mx + Math.cos(currentAngle) * (len / 2);
        p.y2 = my + Math.sin(currentAngle) * (len / 2);
        
        p.vx *= 0.98; // air friction
        
        // Bounce on floor
        if (p.y1 > 400) { p.y1 = 400; p.vy = -p.vy * 0.3; p.vx *= 0.6; }
        if (p.y2 > 400) { p.y2 = 400; p.vy = -p.vy * 0.3; p.vx *= 0.6; }

        ctx.lineWidth = p.width || 9;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.type === 'sword') {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.va;
        
        if (p.y > 400) { p.y = 400; p.vy = -p.vy * 0.35; p.vx *= 0.5; p.va *= 0.4; }
        
        this.drawWoodenSword(ctx, p.x, p.y, p.angle);
      }
    });

    ctx.restore();
  }
}

// Export Stickman class
window.Stickman = Stickman;
