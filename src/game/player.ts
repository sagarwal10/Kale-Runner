/**
 * Kale Runner Player Character
 * Animated green hero with chomping mouth, buffered turns, neon ghost trail, and squash-and-stretch.
 */

import Phaser from 'phaser';
import { MazeBFS, Point } from './levels';
import { PLAYER_BASE_SPEED } from './constants';

export interface PlayerDirection {
  x: number;
  y: number;
}

interface TrailNode {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class Player {
  public scene: Phaser.Scene;
  public graphics: Phaser.GameObjects.Graphics;
  public trailGraphics: Phaser.GameObjects.Graphics;
  public bfs: MazeBFS;
  public originX: number;
  public originY: number;
  public tileSize: number;

  public x: number;
  public y: number;
  public tileX: number;
  public tileY: number;
  public targetTileX: number;
  public targetTileY: number;
  public spawnTile: Point;

  public currentDir: PlayerDirection = { x: 0, y: 0 };
  public bufferedDir: PlayerDirection | null = null;
  public bufferedDirTimer: number = 0;
  public speedPx: number; // pixels per second
  public isMoving: boolean = false;

  // Invincibility
  public isInvincible: boolean = false;
  public invincibilityTimer: number = 0;
  public flashTimer: number = 0;

  // Chomp mouth animation
  private chompPhase: number = 0;
  private currentAngle: number = 0;

  // Juicy Polish: Trail & Squash/Stretch
  private trailNodes: TrailNode[] = [];
  private lastTrailSampleDist: number = 0;
  private stretchX: number = 1.0;
  private stretchY: number = 1.0;

  constructor(
    scene: Phaser.Scene,
    startTile: Point,
    bfs: MazeBFS,
    originX: number,
    originY: number,
    tileSize: number
  ) {
    this.scene = scene;
    this.bfs = bfs;
    this.originX = originX;
    this.originY = originY;
    this.tileSize = tileSize;
    this.spawnTile = { ...startTile };

    this.tileX = startTile.x;
    this.tileY = startTile.y;
    this.targetTileX = startTile.x;
    this.targetTileY = startTile.y;

    // Player speed: 4.4 tiles per second enabled right from the start
    this.speedPx = PLAYER_BASE_SPEED * this.tileSize;

    this.x = this.originX + startTile.x * this.tileSize + this.tileSize / 2;
    this.y = this.originY + startTile.y * this.tileSize + this.tileSize / 2;

    this.trailGraphics = scene.add.graphics();
    this.trailGraphics.setDepth(13);

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(15);
    this.draw();
  }

  public resetToStart(): void {
    this.tileX = this.spawnTile.x;
    this.tileY = this.spawnTile.y;
    this.targetTileX = this.spawnTile.x;
    this.targetTileY = this.spawnTile.y;

    this.speedPx = PLAYER_BASE_SPEED * this.tileSize;
    this.x = this.originX + this.tileX * this.tileSize + this.tileSize / 2;
    this.y = this.originY + this.tileY * this.tileSize + this.tileSize / 2;
    this.currentDir = { x: 0, y: 0 };
    this.bufferedDir = null;
    this.bufferedDirTimer = 0;
    this.isMoving = false;
    this.trailNodes = [];
    this.stretchX = 1.0;
    this.stretchY = 1.0;
    this.triggerInvincibility(1.5);
    this.draw();
  }

  public triggerInvincibility(durationSec: number): void {
    this.isInvincible = true;
    this.invincibilityTimer = durationSec;
    this.flashTimer = 0;
  }

  /**
   * Attempts to execute a turn into `dir` with generous corner-cutting leniency.
   * If the player is within cornering distance (~46% of a tile) of an intersection
   * that is open in `dir`, it automatically aligns the player with the alleyway
   * and turns immediately, preventing missed corners and unresponsive inputs.
   */
  public tryExecuteTurn(dir: PlayerDirection): boolean {
    // 1. Instant 180° reversal mid-corridor
    if (
      (this.currentDir.x !== 0 && dir.x === -this.currentDir.x) ||
      (this.currentDir.y !== 0 && dir.y === -this.currentDir.y)
    ) {
      const tempX = this.tileX;
      this.tileX = this.targetTileX;
      this.targetTileX = tempX;
      const tempY = this.tileY;
      this.tileY = this.targetTileY;
      this.targetTileY = tempY;
      this.currentDir = { ...dir };
      this.bufferedDir = null;
      this.bufferedDirTimer = 0;
      this.isMoving = true;
      this.triggerSquashAndStretch(dir);
      return true;
    }

    // 2. If stationary, start moving immediately if walkable
    if (!this.isMoving || (this.currentDir.x === 0 && this.currentDir.y === 0)) {
      if (this.bfs.isWalkable(this.tileX + dir.x, this.tileY + dir.y)) {
        this.currentDir = { ...dir };
        this.targetTileX = this.tileX + dir.x;
        this.targetTileY = this.tileY + dir.y;
        this.bufferedDir = null;
        this.bufferedDirTimer = 0;
        this.isMoving = true;
        this.triggerSquashAndStretch(dir);
        return true;
      }
      return false;
    }

    // 3. Same direction: already moving this way
    if (dir.x === this.currentDir.x && dir.y === this.currentDir.y) {
      return true;
    }

    // 4. Perpendicular corner turn (e.g. moving horizontal, turning vertical, or vice-versa)
    const gridX = (this.x - this.originX - this.tileSize / 2) / this.tileSize;
    const gridY = (this.y - this.originY - this.tileSize / 2) / this.tileSize;
    const cornerThreshold = 0.46; // up to 46% of a tile before/after intersection center

    if (this.currentDir.x !== 0 && dir.y !== 0) {
      // Currently moving horizontally; player requests turning UP or DOWN into an alleyway
      const candidateX = Math.round(gridX);
      const distFromCenter = Math.abs(gridX - candidateX);

      if (distFromCenter <= cornerThreshold) {
        const corridorY = this.tileY;
        if (
          this.bfs.isWalkable(candidateX, corridorY) &&
          this.bfs.isWalkable(candidateX, corridorY + dir.y)
        ) {
          // Snap/align X to the alleyway centerline so player doesn't clip walls
          this.x = this.originX + candidateX * this.tileSize + this.tileSize / 2;
          this.tileX = candidateX;
          this.tileY = corridorY;
          this.currentDir = { ...dir };
          this.targetTileX = candidateX;
          this.targetTileY = corridorY + dir.y;
          this.bufferedDir = null;
          this.bufferedDirTimer = 0;
          this.isMoving = true;
          this.triggerSquashAndStretch(dir);
          return true;
        }
      }
    } else if (this.currentDir.y !== 0 && dir.x !== 0) {
      // Currently moving vertically; player requests turning LEFT or RIGHT into an alleyway
      const candidateY = Math.round(gridY);
      const distFromCenter = Math.abs(gridY - candidateY);

      if (distFromCenter <= cornerThreshold) {
        const corridorX = this.tileX;
        if (
          this.bfs.isWalkable(corridorX, candidateY) &&
          this.bfs.isWalkable(corridorX + dir.x, candidateY)
        ) {
          // Snap/align Y to the alleyway centerline so player doesn't clip walls
          this.y = this.originY + candidateY * this.tileSize + this.tileSize / 2;
          this.tileX = corridorX;
          this.tileY = candidateY;
          this.currentDir = { ...dir };
          this.targetTileX = corridorX + dir.x;
          this.targetTileY = candidateY;
          this.bufferedDir = null;
          this.bufferedDirTimer = 0;
          this.isMoving = true;
          this.triggerSquashAndStretch(dir);
          return true;
        }
      }
    }

    return false;
  }

  public requestDirection(dir: PlayerDirection): void {
    // Attempt immediate turn if in cornering range
    if (this.tryExecuteTurn(dir)) {
      return;
    }

    // Buffer the turn with a 0.5s pre-turn window so approaching alleyways are automatically caught
    this.bufferedDir = { ...dir };
    this.bufferedDirTimer = 0.5;
  }

  private triggerSquashAndStretch(dir: PlayerDirection): void {
    if (dir.x !== 0) {
      this.stretchX = 1.25;
      this.stretchY = 0.8;
    } else if (dir.y !== 0) {
      this.stretchX = 0.8;
      this.stretchY = 1.25;
    }
  }

  public update(dtSeconds: number): void {
    // Invincibility countdown
    if (this.isInvincible) {
      this.invincibilityTimer -= dtSeconds;
      this.flashTimer += dtSeconds;
      if (this.invincibilityTimer <= 0) {
        this.isInvincible = false;
        this.graphics.setAlpha(1);
      } else {
        const visible = Math.floor(this.flashTimer * 10) % 2 === 0;
        this.graphics.setAlpha(visible ? 0.95 : 0.25);
      }
    } else {
      this.graphics.setAlpha(1);
    }

    // Elastic squash-and-stretch recovery
    this.stretchX += (1.0 - this.stretchX) * Math.min(1, dtSeconds * 12);
    this.stretchY += (1.0 - this.stretchY) * Math.min(1, dtSeconds * 12);

    // Pre-turn buffer countdown & continuous check
    if (this.bufferedDir) {
      this.bufferedDirTimer -= dtSeconds;
      if (this.bufferedDirTimer <= 0) {
        this.bufferedDir = null;
      } else {
        this.tryExecuteTurn(this.bufferedDir);
      }
    }

    // Movement
    if (this.isMoving && (this.currentDir.x !== 0 || this.currentDir.y !== 0)) {
      const moveDist = this.speedPx * dtSeconds;
      this.stepTileMovement(moveDist);
      this.chompPhase += dtSeconds * 15;

      if (this.currentDir.x === 1) this.currentAngle = 0;
      else if (this.currentDir.x === -1) this.currentAngle = Math.PI;
      else if (this.currentDir.y === 1) this.currentAngle = Math.PI / 2;
      else if (this.currentDir.y === -1) this.currentAngle = -Math.PI / 2;

      // Sample neon speed trail
      this.lastTrailSampleDist += moveDist;
      if (this.lastTrailSampleDist >= 8) {
        this.lastTrailSampleDist = 0;
        this.trailNodes.push({
          x: this.x,
          y: this.y,
          angle: this.currentAngle,
          alpha: 0.45,
        });
      }
    }

    // Update and draw speed trail
    this.updateTrail(dtSeconds);

    this.draw();
  }

  private updateTrail(dtSeconds: number): void {
    this.trailGraphics.clear();
    const radius = this.tileSize * 0.38;

    for (let i = this.trailNodes.length - 1; i >= 0; i--) {
      const node = this.trailNodes[i];
      node.alpha -= dtSeconds * 2.8;

      if (node.alpha <= 0) {
        this.trailNodes.splice(i, 1);
      } else {
        this.trailGraphics.fillStyle(0x10b981, node.alpha * 0.4);
        this.trailGraphics.fillCircle(node.x, node.y, radius * (0.6 + node.alpha * 0.4));
      }
    }
  }

  private stepTileMovement(distance: number): void {
    const targetPxX = this.originX + this.targetTileX * this.tileSize + this.tileSize / 2;
    const targetPxY = this.originY + this.targetTileY * this.tileSize + this.tileSize / 2;

    const dx = targetPxX - this.x;
    const dy = targetPxY - this.y;
    const distToTarget = Math.hypot(dx, dy);

    if (distToTarget <= distance || distToTarget < 0.5) {
      this.x = targetPxX;
      this.y = targetPxY;
      this.tileX = this.targetTileX;
      this.tileY = this.targetTileY;

      const remainingDist = Math.max(0, distance - distToTarget);

      // 1. Check buffered direction turn
      if (this.bufferedDir && this.tryExecuteTurn(this.bufferedDir)) {
        this.x += this.currentDir.x * remainingDist;
        this.y += this.currentDir.y * remainingDist;
        return;
      }

      // 2. Continue in current direction if open
      if (this.bfs.isWalkable(this.tileX + this.currentDir.x, this.tileY + this.currentDir.y)) {
        this.targetTileX = this.tileX + this.currentDir.x;
        this.targetTileY = this.tileY + this.currentDir.y;
        this.isMoving = true;

        this.x += this.currentDir.x * remainingDist;
        this.y += this.currentDir.y * remainingDist;
      } else {
        this.isMoving = false;
        this.currentDir = { x: 0, y: 0 };
      }
    } else {
      this.x += (dx / distToTarget) * distance;
      this.y += (dy / distToTarget) * distance;
    }
  }

  private draw(): void {
    this.graphics.clear();

    const baseRadius = this.tileSize * 0.42;
    const radiusX = baseRadius * this.stretchX;
    const radiusY = baseRadius * this.stretchY;

    const mouthAngle = this.isMoving ? 0.05 + Math.abs(Math.sin(this.chompPhase)) * 0.45 : 0.06;

    // Glowing outer aura
    this.graphics.fillStyle(0x22c55e, 0.28);
    this.graphics.fillCircle(this.x, this.y, baseRadius + 6);

    // Hero body (Kale green)
    this.graphics.fillStyle(0x22c55e, 1.0);
    this.graphics.slice(
      this.x,
      this.y,
      Math.max(radiusX, radiusY),
      this.currentAngle + mouthAngle,
      this.currentAngle + Math.PI * 2 - mouthAngle,
      false
    );
    this.graphics.fillPath();

    // Dark emerald border
    this.graphics.lineStyle(2, 0x15803d, 1.0);
    this.graphics.slice(
      this.x,
      this.y,
      Math.max(radiusX, radiusY),
      this.currentAngle + mouthAngle,
      this.currentAngle + Math.PI * 2 - mouthAngle,
      false
    );
    this.graphics.strokePath();

    // Eye with gleam
    const eyeOffsetAngle = this.currentAngle - Math.PI / 3;
    const eyeDist = baseRadius * 0.55;
    const eyeX = this.x + Math.cos(eyeOffsetAngle) * eyeDist;
    const eyeY = this.y + Math.sin(eyeOffsetAngle) * eyeDist;

    this.graphics.fillStyle(0xffffff, 1.0);
    this.graphics.fillCircle(eyeX, eyeY, Math.max(2.8, baseRadius * 0.24));

    this.graphics.fillStyle(0x0f172a, 1.0);
    this.graphics.fillCircle(
      eyeX + Math.cos(this.currentAngle) * 1.0,
      eyeY + Math.sin(this.currentAngle) * 1.0,
      Math.max(1.6, baseRadius * 0.13)
    );

    // Eye catchlight spark
    this.graphics.fillStyle(0xffffff, 0.9);
    this.graphics.fillCircle(
      eyeX - 0.7,
      eyeY - 0.7,
      Math.max(0.8, baseRadius * 0.07)
    );

    // Kale leaf sprout on top
    const leafAngle = this.currentAngle - Math.PI / 2;
    const leafX = this.x + Math.cos(leafAngle) * (baseRadius + 2.5);
    const leafY = this.y + Math.sin(leafAngle) * (baseRadius + 2.5);
    this.graphics.fillStyle(0x4ade80, 0.95);
    this.graphics.fillCircle(leafX, leafY, Math.max(2.2, baseRadius * 0.18));
  }

  public destroy(): void {
    this.trailGraphics.destroy();
    this.graphics.destroy();
  }
}
