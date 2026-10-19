/**
 * Junk food enemies with distinct BFS-based AI personalities:
 * - 🥤 Soda: Fast, erratic
 * - 🍕 Pizza: Direct chaser
 * - 🍩 Donut: Ambusher (4 tiles ahead of player)
 * - 🎂 Cake: Slow blocker (patrols exit door corridors)
 *
 * Rock-solid tile-to-tile movement guarantees no getting stuck or wall clipping.
 */

import Phaser from 'phaser';
import { EnemyConfig, ENEMY_CONFIGS, EnemyType } from './constants';
import { MazeBFS, Point } from './levels';
import { Player } from './player';

export class Enemy {
  public scene: Phaser.Scene;
  public bfs: MazeBFS;
  public config: EnemyConfig;
  public type: EnemyType;
  public originX: number;
  public originY: number;
  public tileSize: number;

  public homeTile: Point;
  public tileX: number;
  public tileY: number;
  public targetTileX: number;
  public targetTileY: number;

  public x: number;
  public y: number;

  public currentDir: { dx: number; dy: number } = { dx: 0, dy: 0 };
  public speedPx: number; // in pixels per second

  // Sleep / Park state
  public isParked: boolean = true;
  public wakeUpDelay: number = 0;
  public wakeUpTimer: number = 0;
  public hasPlayerMoved: boolean = false;

  // Frightened state
  public isFrightened: boolean = false;
  public frightenedTimer: number = 0;
  public isReturningHome: boolean = false;

  // Visuals
  public container: Phaser.GameObjects.Container;
  public auraGraphics: Phaser.GameObjects.Graphics;
  public emojiText: Phaser.GameObjects.Text;
  public statusText: Phaser.GameObjects.Text;
  public bobPhase: number = Math.random() * Math.PI * 2;

  // Cake specific: exit door anchor
  public exitDoorTile: Point | null = null;
  public cakePatrolTarget: Point | null = null;
  public cakePatrolTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    spawnTile: Point,
    bfs: MazeBFS,
    originX: number,
    originY: number,
    tileSize: number,
    speedMultiplier: number = 1.0,
    delayWakeUp: number = 0,
    exitDoorTile: Point | null = null
  ) {
    this.scene = scene;
    this.type = type;
    this.config = ENEMY_CONFIGS[type];
    this.bfs = bfs;
    this.originX = originX;
    this.originY = originY;
    this.tileSize = tileSize;
    this.homeTile = { ...spawnTile };

    this.tileX = spawnTile.x;
    this.tileY = spawnTile.y;
    this.targetTileX = spawnTile.x;
    this.targetTileY = spawnTile.y;

    // Convert tiles/sec to px/sec
    this.speedPx = this.config.baseSpeed * this.tileSize * speedMultiplier;
    this.wakeUpDelay = delayWakeUp;
    this.wakeUpTimer = delayWakeUp;
    this.exitDoorTile = exitDoorTile;

    this.x = this.originX + spawnTile.x * this.tileSize + this.tileSize / 2;
    this.y = this.originY + spawnTile.y * this.tileSize + this.tileSize / 2;

    this.container = scene.add.container(this.x, this.y);
    this.container.setDepth(14);

    this.auraGraphics = scene.add.graphics();
    this.container.add(this.auraGraphics);

    const emojiFontSize = `${Math.round(this.tileSize * 0.68)}px`;
    this.emojiText = scene.add.text(0, 0, this.config.emoji, {
      fontSize: emojiFontSize,
      fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    });
    this.emojiText.setOrigin(0.5, 0.5);
    this.container.add(this.emojiText);

    // Status label (e.g. "💤 3s")
    this.statusText = scene.add.text(0, -this.tileSize * 0.55, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fef08a',
      backgroundColor: '#0f172a',
      padding: { x: 4, y: 1 },
    });
    this.statusText.setOrigin(0.5, 0.5);
    this.statusText.setVisible(false);
    this.container.add(this.statusText);

    // Micro-animation telegraph icon (bubbles, steam, sparkles, candle)
    let telegraphEmoji = '';
    if (this.type === 'soda') telegraphEmoji = '🫧';
    else if (this.type === 'pizza') telegraphEmoji = '♨️';
    else if (this.type === 'donut') telegraphEmoji = '✨';
    else if (this.type === 'cake') telegraphEmoji = '🕯️';

    const telegraphText = scene.add.text(this.tileSize * 0.32, -this.tileSize * 0.36, telegraphEmoji, {
      fontSize: `${Math.round(this.tileSize * 0.34)}px`,
    });
    telegraphText.setOrigin(0.5, 0.5);
    this.container.add(telegraphText);

    // Animate telegraph icon with gentle float/fade
    scene.tweens.add({
      targets: telegraphText,
      y: -this.tileSize * 0.48,
      alpha: 0.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (this.wakeUpDelay > 0) {
      this.statusText.setText(`💤 ${this.wakeUpDelay}s`);
      this.statusText.setVisible(true);
    }

    this.drawAura();
  }

  public resetToHome(): void {
    this.tileX = this.homeTile.x;
    this.tileY = this.homeTile.y;
    this.targetTileX = this.homeTile.x;
    this.targetTileY = this.homeTile.y;

    this.x = this.originX + this.homeTile.x * this.tileSize + this.tileSize / 2;
    this.y = this.originY + this.homeTile.y * this.tileSize + this.tileSize / 2;
    this.container.setPosition(this.x, this.y);

    this.currentDir = { dx: 0, dy: 0 };
    this.isReturningHome = false;
    this.isFrightened = false;
    this.frightenedTimer = 0;
    this.isParked = false; // Once reset after hit, it continues to patrol
    this.statusText.setVisible(false);
    this.drawAura();
  }

  public activateAfterPlayerMove(): void {
    this.hasPlayerMoved = true;
    if (this.wakeUpDelay <= 0) {
      this.isParked = false;
      this.statusText.setVisible(false);
    }
  }

  public setFrightened(durationSec: number): void {
    if (this.isReturningHome) return;
    this.isFrightened = true;
    this.frightenedTimer = durationSec;

    // Classic Pac-Man: reverse direction immediately!
    if (this.currentDir.dx !== 0 || this.currentDir.dy !== 0) {
      // Swap target and current tile to reverse mid-cell
      const tempX = this.tileX;
      const tempY = this.tileY;
      this.tileX = this.targetTileX;
      this.tileY = this.targetTileY;
      this.targetTileX = tempX;
      this.targetTileY = tempY;
      this.currentDir = { dx: -this.currentDir.dx, dy: -this.currentDir.dy };
    }
    this.drawAura();
  }

  public update(dtSeconds: number, player: Player): void {
    // If parked and player moved, count down wake-up snooze timer
    if (this.isParked) {
      if (this.hasPlayerMoved && this.wakeUpTimer > 0) {
        this.wakeUpTimer -= dtSeconds;
        const remainingSec = Math.max(1, Math.ceil(this.wakeUpTimer));
        this.statusText.setText(`💤 ${remainingSec}s`);
        this.statusText.setVisible(true);

        if (this.wakeUpTimer <= 0) {
          this.isParked = false;
          this.statusText.setText('👀 CHASE!');
          this.scene.time.delayedCall(1200, () => {
            if (this.statusText) this.statusText.setVisible(false);
          });
        }
      }
      return;
    }

    // Frightened countdown
    if (this.isFrightened) {
      this.frightenedTimer -= dtSeconds;
      if (this.frightenedTimer <= 0) {
        this.isFrightened = false;
        this.drawAura();
      } else if (this.frightenedTimer <= 1.5) {
        // Flash in last 1.5s
        const flash = Math.floor(this.frightenedTimer * 8) % 2 === 0;
        this.container.setAlpha(flash ? 0.95 : 0.35);
      } else {
        this.container.setAlpha(0.65);
      }
    } else if (!this.isReturningHome) {
      this.container.setAlpha(1.0);
    }

    // Gentle bob animation
    this.bobPhase += dtSeconds * 5;
    this.emojiText.setY(Math.sin(this.bobPhase) * 2);

    // Calculate effective speed
    let effectiveSpeed = this.speedPx;
    if (this.isFrightened) {
      effectiveSpeed *= 0.58;
    } else if (this.isReturningHome) {
      effectiveSpeed *= 2.0;
    }

    // Step tile-to-tile movement
    const moveDist = effectiveSpeed * dtSeconds;
    this.stepTileMovement(moveDist, player);
    this.container.setPosition(this.x, this.y);
  }

  private stepTileMovement(distance: number, player: Player): void {
    // Target pixel coordinates
    const targetPxX = this.originX + this.targetTileX * this.tileSize + this.tileSize / 2;
    const targetPxY = this.originY + this.targetTileY * this.tileSize + this.tileSize / 2;

    const dx = targetPxX - this.x;
    const dy = targetPxY - this.y;
    const distToTarget = Math.hypot(dx, dy);

    // Check if reached target tile
    if (distToTarget <= distance || distToTarget < 0.5) {
      // Arrived at target tile
      this.x = targetPxX;
      this.y = targetPxY;
      this.tileX = this.targetTileX;
      this.tileY = this.targetTileY;

      // If returning home and reached home
      if (this.isReturningHome && this.tileX === this.homeTile.x && this.tileY === this.homeTile.y) {
        this.resetToHome();
        return;
      }

      const remainingDist = Math.max(0, distance - distToTarget);

      // Decide next tile
      const nextDir = this.decideNextDirection(player);
      if (nextDir && this.bfs.isWalkable(this.tileX + nextDir.dx, this.tileY + nextDir.dy)) {
        this.currentDir = nextDir;
        this.targetTileX = this.tileX + nextDir.dx;
        this.targetTileY = this.tileY + nextDir.dy;

        // Apply remaining distance
        this.x += this.currentDir.dx * remainingDist;
        this.y += this.currentDir.dy * remainingDist;
      } else {
        this.currentDir = { dx: 0, dy: 0 };
      }
    } else {
      // Move toward target
      this.x += (dx / distToTarget) * distance;
      this.y += (dy / distToTarget) * distance;
    }
  }

  private decideNextDirection(player: Player): { dx: number; dy: number } | null {
    const curPoint = { x: this.tileX, y: this.tileY };
    // Forbidden direction: cannot do 180° reverse mid-maze
    const forbidden =
      this.currentDir.dx !== 0 || this.currentDir.dy !== 0
        ? { dx: -this.currentDir.dx, dy: -this.currentDir.dy }
        : undefined;

    // 1. Returning home
    if (this.isReturningHome) {
      return this.bfs.getNextStep(curPoint, this.homeTile, forbidden);
    }

    // 2. Frightened: flee from player
    if (this.isFrightened) {
      const fleeStep = this.bfs.getFleeStep(curPoint, { x: player.tileX, y: player.tileY }, forbidden);
      if (fleeStep) return fleeStep;
    }

    // 3. Normal distinct AI personalities
    switch (this.type) {
      case 'pizza': {
        // Direct chaser: paths straight to player's current tile!
        const target = { x: player.tileX, y: player.tileY };
        const step = this.bfs.getNextStep(curPoint, target, forbidden);
        return step;
      }

      case 'soda': {
        // Fast, erratic: picks random direction at intersection, with 40% chance to chase
        const legalDirs = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ].filter((d) => {
          if (forbidden && d.dx === forbidden.dx && d.dy === forbidden.dy) return false;
          return this.bfs.isWalkable(curPoint.x + d.dx, curPoint.y + d.dy);
        });

        if (legalDirs.length === 0) {
          return forbidden && this.bfs.isWalkable(curPoint.x + forbidden.dx, curPoint.y + forbidden.dy)
            ? { dx: forbidden.dx, dy: forbidden.dy }
            : null;
        }

        if (Math.random() < 0.4) {
          const direct = this.bfs.getNextStep(curPoint, { x: player.tileX, y: player.tileY }, forbidden);
          if (direct) return direct;
        }

        const choice = legalDirs[Math.floor(Math.random() * legalDirs.length)];
        return choice;
      }

      case 'donut': {
        // Ambusher: targets tile ~4 tiles ahead of player facing direction
        const facingX = player.currentDir.x;
        const facingY = player.currentDir.y;
        const rawTarget = {
          x: player.tileX + (facingX !== 0 ? facingX * 4 : 0),
          y: player.tileY + (facingY !== 0 ? facingY * 4 : 0),
        };
        const ambushingTarget = this.bfs.getNearestWalkable(rawTarget);
        const step = this.bfs.getNextStep(curPoint, ambushingTarget, forbidden);
        return step;
      }

      case 'cake': {
        // Slow blocker: patrols corridors near exit door
        if (!this.exitDoorTile) {
          return this.bfs.getNextStep(curPoint, { x: player.tileX, y: player.tileY }, forbidden);
        }

        this.cakePatrolTimer -= 0.05;
        if (!this.cakePatrolTarget || this.cakePatrolTimer <= 0) {
          this.cakePatrolTimer = 4.0;
          const door = this.exitDoorTile;
          const candidates: Point[] = [];
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const nx = door.x + dx;
              const ny = door.y + dy;
              if (this.bfs.isWalkable(nx, ny)) {
                candidates.push({ x: nx, y: ny });
              }
            }
          }
          this.cakePatrolTarget =
            candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : door;
        }

        const step = this.bfs.getNextStep(curPoint, this.cakePatrolTarget, forbidden);
        return step;
      }
    }
  }

  private drawAura(): void {
    this.auraGraphics.clear();
    const radius = this.tileSize * 0.44;
    const color = Phaser.Display.Color.HexStringToColor(this.config.color).color;

    if (this.isFrightened) {
      this.auraGraphics.fillStyle(0x67e8f9, 0.35);
      this.auraGraphics.fillCircle(0, 0, radius);
      this.auraGraphics.lineStyle(2, 0x38bdf8, 0.7);
      this.auraGraphics.strokeCircle(0, 0, radius);
    } else {
      this.auraGraphics.fillStyle(color, 0.22);
      this.auraGraphics.fillCircle(0, 0, radius);
      this.auraGraphics.lineStyle(2, color, 0.55);
      this.auraGraphics.strokeCircle(0, 0, radius);
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}
