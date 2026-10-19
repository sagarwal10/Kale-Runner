/**
 * KaleRunnerScene
 * Main gameplay scene for KALE RUNNER with modern arcade visuals,
 * dual-tone neon bloom, bioluminescent spores, juicy bursts, combo streaks, and screen shake.
 */

import Phaser from 'phaser';
import { sound } from './audio';
import {
  BOTTOM_BAR_HEIGHT,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GAME_OVER_SCORE,
  HUD_HEIGHT,
  POWER_VEGGIE_EMOJIS,
  SCORE_EAT_ENEMY,
  SCORE_POWER_VEGGIE,
  SCORE_VEGGIE,
  STORAGE_KEY_BEST_SCORE,
  STORAGE_KEY_HIGHEST_LEVEL,
  VEGGIE_EMOJIS,
  BERRY_LOOKUP,
  BerryDef,
  SUPERFOOD_LOOKUP,
  SUPERFOOD_VARIETIES,
  SuperfoodDef,
} from './constants';
import { Enemy } from './enemy';
import { HUDManager } from './hud';
import { LevelDef, LEVELS, MazeBFS, Point } from './levels';
import { Player } from './player';

interface PelletItem {
  tileX: number;
  tileY: number;
  isPower: boolean;
  emoji: string;
  berry?: BerryDef;
  superfood?: SuperfoodDef;
  container: Phaser.GameObjects.Container;
  pulseTween?: Phaser.Tweens.Tween;
}

interface AmbientSpore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulse: number;
}

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  radius: number;
  alpha: number;
  decay: number;
}

export class KaleRunnerScene extends Phaser.Scene {
  // Level & state
  private currentLevelIndex: number = 0;
  private currentLevelDef!: LevelDef;
  private bfs!: MazeBFS;

  // Responsive grid metrics
  private tileSize: number = 32;
  private originX: number = 0;
  private originY: number = 0;

  // Gameplay entities
  private player!: Player;
  private enemies: Enemy[] = [];
  private pellets: PelletItem[] = [];
  private exitDoorTile!: Point;
  private exitDoorContainer!: Phaser.GameObjects.Container;
  private doorAuraGraphics!: Phaser.GameObjects.Graphics;
  private doorEmojiText!: Phaser.GameObjects.Text;
  private doorHighlightContainer?: Phaser.GameObjects.Container;
  private doorUnlockedBeaconContainer?: Phaser.GameObjects.Container;
  private isDoorZooming: boolean = false;
  private wallsGraphics!: Phaser.GameObjects.Graphics;

  // Visual Polish Layers
  private ambientSporesGraphics!: Phaser.GameObjects.Graphics;
  private ambientSpores: AmbientSpore[] = [];
  private particlesGraphics!: Phaser.GameObjects.Graphics;
  private burstParticles: BurstParticle[] = [];
  private vignetteGraphics!: Phaser.GameObjects.Graphics;

  // Door unlock quota
  private veggiesEatenThisLevel: number = 0;
  private veggiesRequiredThisLevel: number = 15;
  private isDoorUnlocked: boolean = false;
  private lockedThudCooldown: number = 0;

  // Scoring & Stats
  private score: number = 0;
  private bestScore: number = 0;
  private highestLevel: number = 1;
  private levelStartTime: number = 0;
  private totalGameTime: number = 0;

  // Juicy Polish: Combo Streak & Power Vignette
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private powerVeggieRemainingTimer: number = 0;

  // Superfood management: all superfoods displayed with strictly ONE copy of each

  // Game flow flags
  private hasMovedOnceThisLevel: boolean = false;
  private hasMovedEver: boolean = false;
  private isPaused: boolean = false;
  private isSuperfoodPaused: boolean = false;
  private isGameOver: boolean = false;
  private isGameWon: boolean = false;
  private isTransitioningLevel: boolean = false;

  // Consecutive veggies & idle tracking
  private consecutiveVeggiesWithoutHit: number = 0;
  private idleTimeCounter: number = 0;
  private hadNegativeScoreHint: boolean = false;

  // Managers & Overlays
  private hud!: HUDManager;
  private titleOverlayContainer!: Phaser.GameObjects.Container;
  private moveHintContainer!: Phaser.GameObjects.Container;
  private pauseOverlayContainer!: Phaser.GameObjects.Container;
  private bannerOverlayContainer!: Phaser.GameObjects.Container;
  private endOverlayContainer!: Phaser.GameObjects.Container;

  // Key handlers
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private pKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private numKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super('KaleRunnerScene');
  }

  public create(): void {
    // Load best score & highest level from localStorage
    try {
      const savedBest = localStorage.getItem(STORAGE_KEY_BEST_SCORE);
      this.bestScore = savedBest ? parseInt(savedBest, 10) || 0 : 0;
      const savedLevel = localStorage.getItem(STORAGE_KEY_HIGHEST_LEVEL);
      this.highestLevel = savedLevel ? parseInt(savedLevel, 10) || 1 : 1;
    } catch {
      this.bestScore = 0;
      this.highestLevel = 1;
    }

    // Set deep midnight garden atmosphere background color
    this.cameras.main.setBackgroundColor('#07140f');

    // Ambient spore layer (depth: 2)
    this.ambientSporesGraphics = this.add.graphics();
    this.ambientSporesGraphics.setDepth(2);
    this.initAmbientSpores();

    // Particle burst layer (depth: 18)
    this.particlesGraphics = this.add.graphics();
    this.particlesGraphics.setDepth(18);

    // Screen border vignette for power mode (depth: 48)
    this.vignetteGraphics = this.add.graphics();
    this.vignetteGraphics.setDepth(48);
    this.vignetteGraphics.setScrollFactor(0);

    // Create HUD
    this.hud = new HUDManager(this);
    this.hud.updateScore(this.score, this.bestScore);
    this.hud.updateLevel(1, LEVELS.length);

    // Setup input listeners
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Number keys 1-5 for jumping to unlocked levels
    this.numKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
    ];

    // Prevent arrow keys from scrolling page
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // Setup overlays
    this.createTitleOverlay();
    this.createPauseOverlay();
    this.createBannerOverlay();
    this.createEndOverlay();

    // Start Level 1 immediately (NO start screen)
    this.startLevel(0);
  }

  private initAmbientSpores(): void {
    this.ambientSpores = [];
    for (let i = 0; i < 28; i++) {
      this.ambientSpores.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 12,
        vy: -4 - Math.random() * 10,
        radius: 1.2 + Math.random() * 2.2,
        alpha: 0.15 + Math.random() * 0.35,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  private createTitleOverlay(): void {
    this.titleOverlayContainer = this.add.container(CANVAS_WIDTH / 2, HUD_HEIGHT + 75);
    this.titleOverlayContainer.setDepth(80);
    this.titleOverlayContainer.setScrollFactor(0);

    const titleText = this.add.text(0, -18, 'KALE RUNNER', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '36px',
      fontStyle: '900',
      color: '#4ade80',
      stroke: '#052e16',
      strokeThickness: 4,
    });
    titleText.setOrigin(0.5, 0.5);

    const taglineText = this.add.text(0, 18, 'Eat clean. Run fast. Trust no donut.', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '15px',
      fontStyle: '600',
      color: '#cbd5e1',
    });
    taglineText.setOrigin(0.5, 0.5);

    const bg = this.add.graphics();
    bg.fillStyle(0x020617, 0.88);
    bg.fillRoundedRect(-220, -45, 440, 90, 14);
    bg.lineStyle(2, 0x10b981, 0.9);
    bg.strokeRoundedRect(-220, -45, 440, 90, 14);

    this.titleOverlayContainer.add([bg, titleText, taglineText]);

    // Move hint container near player
    this.moveHintContainer = this.add.container(0, 0);
    this.moveHintContainer.setDepth(81);
    this.moveHintContainer.setScrollFactor(0);

    const moveHintText = this.add.text(0, 0, 'Use the arrow keys to move', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    moveHintText.setOrigin(0.5, 0.5);

    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x0f172a, 0.92);
    hintBg.fillRoundedRect(-110, -16, 220, 32, 8);
    hintBg.lineStyle(1.5, 0x38bdf8, 0.85);
    hintBg.strokeRoundedRect(-110, -16, 220, 32, 8);

    this.moveHintContainer.add([hintBg, moveHintText]);

    this.tweens.add({
      targets: this.moveHintContainer,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createPauseOverlay(): void {
    this.pauseOverlayContainer = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.pauseOverlayContainer.setDepth(90);
    this.pauseOverlayContainer.setScrollFactor(0);
    this.pauseOverlayContainer.setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT);

    const box = this.add.graphics();
    box.fillStyle(0x0f172a, 0.95);
    box.fillRoundedRect(-140, -60, 280, 120, 14);
    box.lineStyle(2, 0x38bdf8, 0.8);
    box.strokeRoundedRect(-140, -60, 280, 120, 14);

    const pausedText = this.add.text(0, -16, 'PAUSED', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    pausedText.setOrigin(0.5, 0.5);

    const resumeText = this.add.text(0, 24, 'Press P to resume', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#94a3b8',
    });
    resumeText.setOrigin(0.5, 0.5);

    this.pauseOverlayContainer.add([bg, box, pausedText, resumeText]);
  }

  private createBannerOverlay(): void {
    this.bannerOverlayContainer = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.bannerOverlayContainer.setDepth(92);
    this.bannerOverlayContainer.setScrollFactor(0);
    this.bannerOverlayContainer.setVisible(false);
  }

  private createEndOverlay(): void {
    this.endOverlayContainer = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.endOverlayContainer.setDepth(95);
    this.endOverlayContainer.setScrollFactor(0);
    this.endOverlayContainer.setVisible(false);
  }

  private startLevel(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
    this.currentLevelDef = LEVELS[levelIndex];
    this.bfs = new MazeBFS(this.currentLevelDef.layout);
    this.hasMovedOnceThisLevel = false;
    this.isTransitioningLevel = false;
    this.levelStartTime = this.time.now;
    this.consecutiveVeggiesWithoutHit = 0;
    this.idleTimeCounter = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.powerVeggieRemainingTimer = 0;
    sound.setPowerMode(false);

    // Reset veggie quota tracking for the level
    this.veggiesEatenThisLevel = 0;
    this.veggiesRequiredThisLevel = this.currentLevelDef.veggiesRequired || 15;
    this.isDoorUnlocked = false;

    // Responsive scaling
    const availableWidth = CANVAS_WIDTH - 48;
    const availableHeight = CANVAS_HEIGHT - HUD_HEIGHT - BOTTOM_BAR_HEIGHT - 16;

    this.tileSize = Math.floor(
      Math.min(
        availableWidth / this.currentLevelDef.width,
        availableHeight / this.currentLevelDef.height
      )
    );

    const mazePixelWidth = this.currentLevelDef.width * this.tileSize;
    const mazePixelHeight = this.currentLevelDef.height * this.tileSize;

    this.originX = Math.round((CANVAS_WIDTH - mazePixelWidth) / 2);
    this.originY = Math.round(HUD_HEIGHT + (availableHeight - mazePixelHeight) / 2);

    // Clean up old level entities
    this.cleanupLevel();

    // Parse layout
    let playerStart: Point = { x: 1, y: 1 };
    const enemyHomes: Record<string, Point> = {};
    const veggiePoints: Point[] = [];
    const powerVeggiePoints: Point[] = [];

    for (let y = 0; y < this.currentLevelDef.height; y++) {
      for (let x = 0; x < this.currentLevelDef.width; x++) {
        const char = this.currentLevelDef.layout[y][x];
        if (char === 'P') playerStart = { x, y };
        else if (char === 'D') this.exitDoorTile = { x, y };
        else if (char === '.') veggiePoints.push({ x, y });
        else if (char === 'o') powerVeggiePoints.push({ x, y });
        else if (char === '1' || char === '2' || char === '3' || char === '4') {
          enemyHomes[char] = { x, y };
        }
      }
    }

    // Render walls with dual-tone neon bloom
    this.renderWalls();

    // Render Exit Door (Starts locked!)
    this.renderExitDoor();

    // Render Pellets
    this.renderPellets(veggiePoints, powerVeggiePoints);

    // Create Player
    this.player = new Player(this, playerStart, this.bfs, this.originX, this.originY, this.tileSize);

    // Show big centered startup mission message
    if (!this.hasMovedEver) {
      this.moveHintContainer.setVisible(false);
      this.titleOverlayContainer.setVisible(false);
      this.hud.showStartupMissionMessage();
    }

    // Create Enemies
    this.createEnemies(enemyHomes);

    // Update HUD
    this.hud.resetLevelTriggers();
    this.hud.updateScore(this.score, this.bestScore);
    this.hud.updateLevel(this.currentLevelIndex + 1, LEVELS.length);
    this.hud.setVeggieProgress(0, this.veggiesRequiredThisLevel);

    // Save highest level
    if (this.currentLevelIndex + 1 > this.highestLevel) {
      this.highestLevel = this.currentLevelIndex + 1;
      try {
        localStorage.setItem(STORAGE_KEY_HIGHEST_LEVEL, String(this.highestLevel));
      } catch {}
    }
  }

  private cleanupLevel(): void {
    if (this.wallsGraphics) {
      this.wallsGraphics.destroy();
    }
    if (this.exitDoorContainer) {
      this.exitDoorContainer.destroy();
    }
    if (this.doorHighlightContainer) {
      this.doorHighlightContainer.destroy();
      this.doorHighlightContainer = undefined;
    }
    if (this.doorUnlockedBeaconContainer) {
      this.doorUnlockedBeaconContainer.destroy();
      this.doorUnlockedBeaconContainer = undefined;
    }
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1.0);
    this.isDoorZooming = false;
    if (this.player) {
      this.player.destroy();
    }
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    for (const p of this.pellets) {
      if (p.pulseTween) p.pulseTween.stop();
      p.container.destroy();
    }
    this.pellets = [];
    this.isSuperfoodPaused = false;
    if (this.hud) {
      this.hud.dismissSuperfoodCard();
    }
  }

  /**
   * Renders the maze walls using a clean, uniform green grass tile.
   */
  private renderWalls(): void {
    this.wallsGraphics = this.add.graphics();
    this.wallsGraphics.setDepth(5);

    const layout = this.currentLevelDef.layout;
    const h = this.currentLevelDef.height;
    const w = this.currentLevelDef.width;
    const ts = this.tileSize;

    // Pass 1: Simple, clean floor corridor markers
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (layout[y][x] !== '#') {
          const cx = this.originX + x * ts + ts / 2;
          const cy = this.originY + y * ts + ts / 2;
          this.wallsGraphics.fillStyle(0x10b981, 0.08);
          this.wallsGraphics.fillCircle(cx, cy, 1.5);
        }
      }
    }

    // Pass 2: Single uniform green grass tile for all wall blocks
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (layout[y][x] === '#') {
          const px = this.originX + x * ts;
          const py = this.originY + y * ts;

          // 1. Base dark earth & turf edge
          this.wallsGraphics.fillStyle(0x14532d, 1.0);
          this.wallsGraphics.fillRect(px, py, ts, ts);

          // 2. Rich vibrant green grass body
          this.wallsGraphics.fillStyle(0x15803d, 1.0);
          this.wallsGraphics.fillRect(px + 1, py + 1, ts - 2, ts - 2);

          // 3. Subtle, uniform grass blades texture
          this.drawGrassTileDetails(px, py, ts);

          // 4. Clean border along corridor edges for perfect maze readability
          this.drawGrassWallEdges(layout, x, y, px, py, ts, w, h);
        }
      }
    }
  }

  /**
   * Delicate, uniform grass blade accents that give the tile its authentic grass look.
   */
  private drawGrassTileDetails(px: number, py: number, ts: number): void {
    const bladeColorLight = 0x22c55e;
    const bladeColorDark = 0x166534;

    // Blade tuft 1 (Left-center)
    const b1x = px + ts * 0.32;
    const b1y = py + ts * 0.52;
    this.wallsGraphics.lineStyle(1.2, bladeColorDark, 0.9);
    this.wallsGraphics.lineBetween(b1x, b1y, b1x - ts * 0.08, b1y - ts * 0.18);
    this.wallsGraphics.lineStyle(1.2, bladeColorLight, 0.95);
    this.wallsGraphics.lineBetween(b1x, b1y, b1x + ts * 0.06, b1y - ts * 0.2);

    // Blade tuft 2 (Right-center)
    const b2x = px + ts * 0.68;
    const b2y = py + ts * 0.68;
    this.wallsGraphics.lineStyle(1.2, bladeColorDark, 0.9);
    this.wallsGraphics.lineBetween(b2x, b2y, b2x - ts * 0.06, b2y - ts * 0.18);
    this.wallsGraphics.lineStyle(1.2, bladeColorLight, 0.95);
    this.wallsGraphics.lineBetween(b2x, b2y, b2x + ts * 0.08, b2y - ts * 0.2);

    // Subtle soft grass highlight speck in center
    this.wallsGraphics.fillStyle(0x4ade80, 0.35);
    this.wallsGraphics.fillCircle(px + ts * 0.5, py + ts * 0.32, ts * 0.08);
  }

  /**
   * Crisp, clean outer border along edges facing corridors for optimal maze readability.
   */
  private drawGrassWallEdges(
    layout: string[],
    x: number,
    y: number,
    px: number,
    py: number,
    ts: number,
    w: number,
    h: number
  ): void {
    const edgeDark = 0x0f3d20;
    const edgeHighlight = 0x4ade80;

    // North edge
    if (y === 0 || layout[y - 1][x] !== '#') {
      this.wallsGraphics.lineStyle(2, edgeDark, 1.0);
      this.wallsGraphics.lineBetween(px, py + 1, px + ts, py + 1);
      this.wallsGraphics.lineStyle(1, edgeHighlight, 0.45);
      this.wallsGraphics.lineBetween(px + 1, py + 2, px + ts - 1, py + 2);
    }
    // South edge
    if (y === h - 1 || layout[y + 1][x] !== '#') {
      this.wallsGraphics.lineStyle(2, edgeDark, 1.0);
      this.wallsGraphics.lineBetween(px, py + ts - 1, px + ts, py + ts - 1);
    }
    // West edge
    if (x === 0 || layout[y][x - 1] !== '#') {
      this.wallsGraphics.lineStyle(2, edgeDark, 1.0);
      this.wallsGraphics.lineBetween(px + 1, py, px + 1, py + ts);
      this.wallsGraphics.lineStyle(1, edgeHighlight, 0.45);
      this.wallsGraphics.lineBetween(px + 2, py + 1, px + 2, py + ts - 1);
    }
    // East edge
    if (x === w - 1 || layout[y][x + 1] !== '#') {
      this.wallsGraphics.lineStyle(2, edgeDark, 1.0);
      this.wallsGraphics.lineBetween(px + ts - 1, py, px + ts - 1, py + ts);
    }
  }

  private renderExitDoor(): void {
    const dx = this.originX + this.exitDoorTile.x * this.tileSize + this.tileSize / 2;
    const dy = this.originY + this.exitDoorTile.y * this.tileSize + this.tileSize / 2;

    this.exitDoorContainer = this.add.container(dx, dy);
    this.exitDoorContainer.setDepth(8);

    this.doorAuraGraphics = this.add.graphics();
    const fontSize = `${Math.round(this.tileSize * 0.62)}px`;
    this.doorEmojiText = this.add.text(0, 0, this.isDoorUnlocked ? '🚪' : '🔒', {
      fontSize,
    });
    this.doorEmojiText.setOrigin(0.5, 0.5);

    this.exitDoorContainer.add([this.doorAuraGraphics, this.doorEmojiText]);
    this.updateDoorVisuals();

    // Prominently highlight the locked door at the start of the level
    this.highlightLockedDoorAtStart(dx, dy);
  }

  private highlightLockedDoorAtStart(dx: number, dy: number): void {
    if (this.doorHighlightContainer) {
      this.doorHighlightContainer.destroy();
      this.doorHighlightContainer = undefined;
    }

    const isNearTop = this.exitDoorTile.y <= 2;
    const calloutY = isNearTop ? dy + this.tileSize * 1.3 : dy - this.tileSize * 1.3;
    const calloutX = Math.max(170, Math.min(CANVAS_WIDTH - 170, dx));

    this.doorHighlightContainer = this.add.container(calloutX, calloutY);
    this.doorHighlightContainer.setDepth(55);

    // 1. Concentric pulsating beacon centered right over the door
    const beaconRelX = dx - calloutX;
    const beaconRelY = dy - calloutY;
    const beacon = this.add.graphics();
    beacon.setPosition(beaconRelX, beaconRelY);
    beacon.fillStyle(0xf59e0b, 0.22);
    beacon.fillCircle(0, 0, this.tileSize * 0.72);
    beacon.lineStyle(2.5, 0xfbbf24, 0.95);
    beacon.strokeCircle(0, 0, this.tileSize * 0.72);
    beacon.lineStyle(1.5, 0x10b981, 0.8);
    beacon.strokeCircle(0, 0, this.tileSize * 1.05);

    this.tweens.add({
      targets: beacon,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0.35,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2. Stylish callout badge
    const cardWidth = 286;
    const cardHeight = 48;
    const badge = this.add.graphics();
    badge.fillStyle(0x020617, 0.95);
    badge.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
    badge.lineStyle(2, 0xf59e0b, 0.95);
    badge.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

    const titleText = this.add.text(0, -9, '🔒 LOCKED EXIT DOOR', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '12px',
      fontStyle: '900',
      color: '#fbbf24',
    });
    titleText.setOrigin(0.5, 0.5);

    const arrowSymbol = isNearTop ? '▲' : '▼';
    const subText = this.add.text(
      0,
      9,
      `${arrowSymbol} Head here after eating veggies to escape! ${arrowSymbol}`,
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#f8fafc',
      }
    );
    subText.setOrigin(0.5, 0.5);

    this.doorHighlightContainer.add([beacon, badge, titleText, subText]);

    // Floating bob animation
    this.tweens.add({
      targets: this.doorHighlightContainer,
      y: calloutY + (isNearTop ? 5 : -5),
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateDoorVisuals(): void {
    if (!this.doorAuraGraphics || !this.doorEmojiText) return;
    const boxSize = Math.round(this.tileSize * 0.84);
    this.doorAuraGraphics.clear();

    if (this.isDoorUnlocked) {
      this.doorEmojiText.setText('🚪');
      // Radiant emerald portal glow
      this.doorAuraGraphics.fillStyle(0x10b981, 0.4);
      this.doorAuraGraphics.fillCircle(0, 0, boxSize * 0.62);
      this.doorAuraGraphics.lineStyle(2.5, 0x34d399, 1.0);
      this.doorAuraGraphics.strokeCircle(0, 0, boxSize * 0.62);

      this.tweens.add({
        targets: this.doorAuraGraphics,
        scaleX: 1.15,
        scaleY: 1.15,
        alpha: 0.55,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.doorEmojiText.setText('🔒');
      this.doorAuraGraphics.fillStyle(0xf59e0b, 0.22);
      this.doorAuraGraphics.fillRoundedRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 6);
      this.doorAuraGraphics.lineStyle(2, 0xfbbf24, 0.7);
      this.doorAuraGraphics.strokeRoundedRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 6);
    }
  }

  /**
   * Unlock door with quick cinematic zoom, shockwave ripple, particle burst & guide beacon
   */
  private unlockExitDoor(): void {
    if (this.isDoorUnlocked) return;
    this.isDoorUnlocked = true;
    sound.playDoorUnlocked();
    this.updateDoorVisuals();

    // Destroy start highlight if still active
    if (this.doorHighlightContainer) {
      this.doorHighlightContainer.destroy();
      this.doorHighlightContainer = undefined;
    }

    const doorX = this.exitDoorContainer.x;
    const doorY = this.exitDoorContainer.y;
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    // Expanding shockwave ripple
    const ripple = this.add.graphics();
    ripple.setDepth(20);
    this.tweens.addCounter({
      from: 10,
      to: 500,
      duration: 850,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const val = tween.getValue() ?? 10;
        ripple.clear();
        const alpha = Math.max(0, 1.0 - val / 500);
        ripple.lineStyle(3.5, 0x10b981, alpha);
        ripple.strokeCircle(doorX, doorY, val);
      },
      onComplete: () => {
        ripple.destroy();
      },
    });

    // Particle explosions
    this.createSparkleBurst(doorX, doorY, 0x34d399, 32, 260);
    this.createSparkleBurst(doorX, doorY, 0xfacc15, 18, 190);

    // Show persistent unlocked beacon pointing to door so player knows where to run
    this.showUnlockedDoorBeacon(doorX, doorY);

    // Camera Quick Zoom In on the door!
    this.isDoorZooming = true;

    // Pan camera to door and zoom in
    this.cameras.main.pan(doorX, doorY, 400, 'Cubic.easeInOut', true);
    this.cameras.main.zoomTo(1.45, 400, 'Cubic.easeInOut', true);

    // Floating celebratory text above door in world space
    this.hud.showFloatingScore('DOOR UNLOCKED! 🚪', doorX, doorY - 14, true);

    // Hold zoomed in on door for 700ms, then smoothly pan and zoom back out
    this.time.delayedCall(750, () => {
      this.cameras.main.pan(centerX, centerY, 480, 'Cubic.easeInOut', true);
      this.cameras.main.zoomTo(1.0, 480, 'Cubic.easeInOut', true);

      this.time.delayedCall(490, () => {
        this.cameras.main.setScroll(0, 0);
        this.cameras.main.setZoom(1.0);
        this.isDoorZooming = false;
      });
    });
  }

  private showUnlockedDoorBeacon(doorX: number, doorY: number): void {
    if (this.doorUnlockedBeaconContainer) {
      this.doorUnlockedBeaconContainer.destroy();
      this.doorUnlockedBeaconContainer = undefined;
    }

    const isNearTop = this.exitDoorTile.y <= 2;
    const calloutY = isNearTop ? doorY + this.tileSize * 1.3 : doorY - this.tileSize * 1.3;
    const calloutX = Math.max(160, Math.min(CANVAS_WIDTH - 160, doorX));

    this.doorUnlockedBeaconContainer = this.add.container(calloutX, calloutY);
    this.doorUnlockedBeaconContainer.setDepth(60);

    const cardWidth = 246;
    const cardHeight = 44;

    const bg = this.add.graphics();
    bg.fillStyle(0x022c22, 0.95);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
    bg.lineStyle(2, 0x10b981, 0.95);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);

    const text1 = this.add.text(0, -7, '🚪 DOOR OPEN! ESCAPE HERE!', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '12px',
      fontStyle: '900',
      color: '#4ade80',
    });
    text1.setOrigin(0.5, 0.5);

    const arrowSymbol = isNearTop ? '▲' : '▼';
    const text2 = this.add.text(0, 10, `${arrowSymbol} RUN HERE TO CLEAR LEVEL ${arrowSymbol}`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#a7f3d0',
    });
    text2.setOrigin(0.5, 0.5);

    this.doorUnlockedBeaconContainer.add([bg, text1, text2]);

    // Bob & pulse animation
    this.tweens.add({
      targets: this.doorUnlockedBeaconContainer,
      y: calloutY + (isNearTop ? 4 : -4),
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private renderPellets(veggiePoints: Point[], powerVeggiePoints: Point[]): void {
    let emojiIndex = 0;
    const smallFontSize = `${Math.round(this.tileSize * 0.44)}px`;

    // All distinct superfoods to show on screen: strictly ONE copy of each!
    const allSuperfoods = [...SUPERFOOD_VARIETIES];
    const superfoodSpots: Point[] = [];

    // Prioritize dedicated power veggie spots from the level layout
    for (const pt of powerVeggiePoints) {
      if (superfoodSpots.length < allSuperfoods.length) {
        superfoodSpots.push(pt);
      }
    }

    // If more spots are needed so that EVERY superfood appears on screen, pick evenly spaced floor spots
    if (superfoodSpots.length < allSuperfoods.length && veggiePoints.length > 0) {
      const needed = allSuperfoods.length - superfoodSpots.length;
      const step = Math.max(1, Math.floor(veggiePoints.length / (needed + 1)));
      for (let i = step; i < veggiePoints.length && superfoodSpots.length < allSuperfoods.length; i += step) {
        const pt = veggiePoints[i];
        if (!superfoodSpots.some(s => s.x === pt.x && s.y === pt.y)) {
          superfoodSpots.push(pt);
        }
      }
    }

    const superfoodCoordSet = new Set(superfoodSpots.map(s => `${s.x},${s.y}`));

    // 1. Regular veggies & sprinkled berries (skip spots reserved for superfoods)
    for (const pt of veggiePoints) {
      if (superfoodCoordSet.has(`${pt.x},${pt.y}`)) continue;

      const emoji = VEGGIE_EMOJIS[emojiIndex % VEGGIE_EMOJIS.length];
      emojiIndex++;
      const berry = BERRY_LOOKUP[emoji];

      const px = this.originX + pt.x * this.tileSize + this.tileSize / 2;
      const py = this.originY + pt.y * this.tileSize + this.tileSize / 2;

      const container = this.add.container(px, py);
      container.setDepth(6);

      // Delicate ambient glow for berry varieties
      if (berry) {
        const berryGlow = this.add.graphics();
        berryGlow.fillStyle(berry.glowColor, 0.22);
        berryGlow.fillCircle(0, 0, this.tileSize * 0.32);
        container.add(berryGlow);
      }

      const text = this.add.text(0, 0, emoji, {
        fontSize: smallFontSize,
      });
      text.setOrigin(0.5, 0.5);
      container.add(text);

      this.pellets.push({
        tileX: pt.x,
        tileY: pt.y,
        isPower: false,
        emoji,
        berry,
        container,
      });
    }

    // 2. Extra power spots from layout beyond the superfoods (if any) get regular veggies/berries
    for (let i = allSuperfoods.length; i < powerVeggiePoints.length; i++) {
      const pt = powerVeggiePoints[i];
      if (superfoodCoordSet.has(`${pt.x},${pt.y}`)) continue;

      const emoji = VEGGIE_EMOJIS[emojiIndex % VEGGIE_EMOJIS.length];
      emojiIndex++;
      const berry = BERRY_LOOKUP[emoji];

      const px = this.originX + pt.x * this.tileSize + this.tileSize / 2;
      const py = this.originY + pt.y * this.tileSize + this.tileSize / 2;

      const container = this.add.container(px, py);
      container.setDepth(6);

      if (berry) {
        const berryGlow = this.add.graphics();
        berryGlow.fillStyle(berry.glowColor, 0.22);
        berryGlow.fillCircle(0, 0, this.tileSize * 0.32);
        container.add(berryGlow);
      }

      const text = this.add.text(0, 0, emoji, {
        fontSize: smallFontSize,
      });
      text.setOrigin(0.5, 0.5);
      container.add(text);

      this.pellets.push({
        tileX: pt.x,
        tileY: pt.y,
        isPower: false,
        emoji,
        berry,
        container,
      });
    }

    // 3. Render ALL superfoods on screen simultaneously: strictly ONE copy of each!
    for (let i = 0; i < superfoodSpots.length && i < allSuperfoods.length; i++) {
      const spot = superfoodSpots[i];
      const superfoodDef = allSuperfoods[i];
      this.renderSuperfoodItem(spot, superfoodDef);
    }
  }

  /**
   * Renders a superfood item on the maze floor cleanly and steadily
   * with prominent emoji and crisp name badge (no pulsating glowing heartbeat).
   */
  private renderSuperfoodItem(spot: Point, superfoodDef: SuperfoodDef): void {
    const powerFontSize = `${Math.round(this.tileSize * 0.74)}px`;
    const px = this.originX + spot.x * this.tileSize + this.tileSize / 2;
    const py = this.originY + spot.y * this.tileSize + this.tileSize / 2;

    const container = this.add.container(px, py);
    container.setDepth(7);

    // Static crisp ring around the superfood (colored, non-pulsing, calm and distinct)
    const ring = this.add.graphics();
    // Inner fill disc with subtle tint
    ring.fillStyle(superfoodDef.glowColor, 0.16);
    ring.fillCircle(0, 0, this.tileSize * 0.44);
    // Outer crisp ring matching superfood's theme color
    ring.lineStyle(2.2, superfoodDef.colorHex, 0.95);
    ring.strokeCircle(0, 0, this.tileSize * 0.44);
    // Subtle outer accent ring for high-definition polish
    ring.lineStyle(1.2, 0xffffff, 0.28);
    ring.strokeCircle(0, 0, this.tileSize * 0.52);
    container.add(ring);

    // Center icon: Custom crisp white cauliflower floret illustration or emoji
    if (superfoodDef.id === 'cauliflower') {
      const cauli = this.add.graphics();
      // Outer leafy base
      cauli.fillStyle(0x22c55e, 0.95);
      cauli.fillCircle(-6.5, 3, 5.5);
      cauli.fillCircle(6.5, 3, 5.5);
      cauli.fillCircle(0, 7, 5.5);

      // Bright white cauliflower florets
      cauli.fillStyle(0xffffff, 1.0);
      cauli.fillCircle(0, -4.5, 8);
      cauli.fillCircle(-6, -1, 7);
      cauli.fillCircle(6, -1, 7);
      cauli.fillCircle(-3.5, 3, 6.5);
      cauli.fillCircle(3.5, 3, 6.5);
      cauli.fillCircle(0, 0.5, 7);

      // Light shading texture dots for 3D floret definition
      cauli.fillStyle(0xe2e8f0, 0.75);
      cauli.fillCircle(-2.5, -5, 2.5);
      cauli.fillCircle(3, -3.5, 2.5);
      cauli.fillCircle(0, 1.5, 2.5);
      container.add(cauli);
    } else {
      const text = this.add.text(0, -1, superfoodDef.emoji, {
        fontSize: powerFontSize,
      });
      text.setOrigin(0.5, 0.5);
      container.add(text);
    }

    // Mini name pill badge underneath
    const pillW = Math.max(38, superfoodDef.shortLabel.length * 6 + 10);
    const pillH = 12;
    const pill = this.add.graphics();
    pill.fillStyle(0x020814, 0.92);
    pill.fillRoundedRect(-pillW / 2, this.tileSize * 0.32, pillW, pillH, 3);
    pill.lineStyle(1, superfoodDef.colorHex, 0.75);
    pill.strokeRoundedRect(-pillW / 2, this.tileSize * 0.32, pillW, pillH, 3);

    const pillLabel = this.add.text(0, this.tileSize * 0.32 + 6, superfoodDef.shortLabel, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '7.5px',
      fontStyle: 'bold',
      color: superfoodDef.textColor,
    });
    pillLabel.setOrigin(0.5, 0.5);
    container.add([pill, pillLabel]);

    // Steady, stable scale without pulsating heartbeat tween
    container.setScale(1.0);

    const pelletItem: PelletItem = {
      tileX: spot.x,
      tileY: spot.y,
      isPower: true,
      emoji: superfoodDef.emoji,
      superfood: superfoodDef,
      container,
    };

    this.pellets.push(pelletItem);
  }

  private createEnemies(homes: Record<string, Point>): void {
    // Smooth, gradual difficulty ramp across levels (Level 1: 0.65x, Level 2: 0.76x)
    const speedTable = [0.65, 0.76, 0.88, 1.0, 1.15];
    const speedMult = speedTable[this.currentLevelIndex] ?? 1.0;

    for (const enemyDef of this.currentLevelDef.enemies) {
      let homeKey = '1';
      if (enemyDef.type === 'pizza') homeKey = '1';
      else if (enemyDef.type === 'soda') homeKey = '2';
      else if (enemyDef.type === 'donut') homeKey = '3';
      else if (enemyDef.type === 'cake') homeKey = '4';

      const spawnTile = homes[homeKey] || { x: 1, y: 1 };
      const enemy = new Enemy(
        this,
        enemyDef.type,
        spawnTile,
        this.bfs,
        this.originX,
        this.originY,
        this.tileSize,
        speedMult,
        enemyDef.delayWakeUp || 0,
        this.exitDoorTile
      );

      this.enemies.push(enemy);
    }
  }

  public update(_time: number, delta: number): void {
    const dtSeconds = Math.min(delta / 1000, 0.05);

    // Update ambient background spores
    this.updateAmbientSpores(dtSeconds);

    // Update active particle bursts
    this.updateBurstParticles(dtSeconds);

    if (this.isPaused || this.isSuperfoodPaused || this.isGameOver || this.isGameWon || this.isTransitioningLevel || this.isDoorZooming) {
      this.handlePausedOrEndedInputs();
      return;
    }

    // Update combo timer
    if (this.comboCount > 0) {
      this.comboTimer -= dtSeconds;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    // Update power mode timer & screen vignette
    this.updatePowerModeVignette(dtSeconds);


    // Handle Input & Controls
    this.handleInput(dtSeconds);

    // Update Player
    this.player.update(dtSeconds);

    // Update Enemies
    for (const enemy of this.enemies) {
      enemy.update(dtSeconds, this.player);
    }

    // Check Collisions
    this.checkCollisions();

    // Update HUD & Hint timers
    this.hud.update(dtSeconds);
  }

  /**
   * Ambient drifting bioluminescent spores in background
   */
  private updateAmbientSpores(dt: number): void {
    this.ambientSporesGraphics.clear();

    for (const spore of this.ambientSpores) {
      spore.x += spore.vx * dt;
      spore.y += spore.vy * dt;
      spore.pulse += dt * 3;

      // Wrap around viewport
      if (spore.y < 0) spore.y = CANVAS_HEIGHT;
      if (spore.x < 0) spore.x = CANVAS_WIDTH;
      if (spore.x > CANVAS_WIDTH) spore.x = 0;

      const alphaPulse = spore.alpha * (0.7 + Math.sin(spore.pulse) * 0.3);
      this.ambientSporesGraphics.fillStyle(0x34d399, alphaPulse);
      this.ambientSporesGraphics.fillCircle(spore.x, spore.y, spore.radius);
    }
  }

  /**
   * Juicy particle bursts
   */
  public createSparkleBurst(
    x: number,
    y: number,
    colorHex: number,
    count: number = 8,
    speedMax: number = 140
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMax * (0.4 + Math.random() * 0.6);
      this.burstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colorHex,
        radius: 2 + Math.random() * 3,
        alpha: 1.0,
        decay: 2.2 + Math.random() * 1.5,
      });
    }
  }

  private updateBurstParticles(dt: number): void {
    this.particlesGraphics.clear();

    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const p = this.burstParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= dt * p.decay;

      if (p.alpha <= 0) {
        this.burstParticles.splice(i, 1);
      } else {
        this.particlesGraphics.fillStyle(p.color, p.alpha);
        this.particlesGraphics.fillCircle(p.x, p.y, p.radius * p.alpha);
      }
    }
  }

  /**
   * Screen border glow vignette during Power Veggie Mode
   */
  private updatePowerModeVignette(dt: number): void {
    this.vignetteGraphics.clear();

    if (this.powerVeggieRemainingTimer > 0) {
      this.powerVeggieRemainingTimer -= dt;

      if (this.powerVeggieRemainingTimer <= 0) {
        sound.setPowerMode(false);
      } else {
        const isUrgent = this.powerVeggieRemainingTimer <= 1.5;
        const pulse = Math.abs(Math.sin(this.time.now / (isUrgent ? 100 : 220)));

        const strokeColor = isUrgent ? 0xf59e0b : 0x10b981;
        const alpha = 0.25 + pulse * 0.35;

        this.vignetteGraphics.lineStyle(12, strokeColor, alpha);
        this.vignetteGraphics.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
  }

  private handlePausedOrEndedInputs(): void {
    if (this.isSuperfoodPaused) {
      if (
        Phaser.Input.Keyboard.JustDown(this.cursors.space!) ||
        (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey))
      ) {
        this.hud.dismissSuperfoodCard();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.pKey)) {
      this.togglePause();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      sound.toggleMute();
      return;
    }

    if (this.isGameOver || this.isGameWon) {
      const anyArrowPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.down!) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.left!) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.right!) ||
        Phaser.Input.Keyboard.JustDown(this.wasdKeys.W) ||
        Phaser.Input.Keyboard.JustDown(this.wasdKeys.A) ||
        Phaser.Input.Keyboard.JustDown(this.wasdKeys.S) ||
        Phaser.Input.Keyboard.JustDown(this.wasdKeys.D);

      if (anyArrowPressed) {
        this.restartGame();
      }
    }
  }

  private handleInput(dtSeconds: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.pKey)) {
      this.togglePause();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      sound.toggleMute();
      return;
    }

    // Number keys 1-5: Jump to any unlocked level
    for (let i = 0; i < this.numKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
        if (i < this.highestLevel) {
          this.startLevel(i);
          this.hud.showEncouragement(`Jumping to Level ${i + 1}!`, true);
          return;
        } else {
          this.hud.showEncouragement(`Level ${i + 1} locked! Beat Level ${i} first.`, true);
        }
      }
    }

    // Arrow / WASD movement with newest key priority and perpendicular alleyway turn preference
    let requestedDir: { x: number; y: number } | null = null;

    // 1. Highest priority: Any key just pressed down on this frame
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.A)) {
      requestedDir = { x: -1, y: 0 };
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right!) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.D)) {
      requestedDir = { x: 1, y: 0 };
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up!) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.W)) {
      requestedDir = { x: 0, y: -1 };
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.S)) {
      requestedDir = { x: 0, y: 1 };
    }

    // 2. If no new key was just pressed, evaluate currently held keys.
    // Prioritize perpendicular turning attempts (into alleyways) over continuing along the current axis!
    if (!requestedDir) {
      const isLeftDown = this.cursors.left!.isDown || this.wasdKeys.A.isDown;
      const isRightDown = this.cursors.right!.isDown || this.wasdKeys.D.isDown;
      const isUpDown = this.cursors.up!.isDown || this.wasdKeys.W.isDown;
      const isDownDown = this.cursors.down!.isDown || this.wasdKeys.S.isDown;

      if (this.player.currentDir.x !== 0) {
        // Currently moving horizontally: prioritize vertical turning inputs into alleyways!
        if (isUpDown) requestedDir = { x: 0, y: -1 };
        else if (isDownDown) requestedDir = { x: 0, y: 1 };
        else if (isLeftDown) requestedDir = { x: -1, y: 0 };
        else if (isRightDown) requestedDir = { x: 1, y: 0 };
      } else if (this.player.currentDir.y !== 0) {
        // Currently moving vertically: prioritize horizontal turning inputs into alleyways!
        if (isLeftDown) requestedDir = { x: -1, y: 0 };
        else if (isRightDown) requestedDir = { x: 1, y: 0 };
        else if (isUpDown) requestedDir = { x: 0, y: -1 };
        else if (isDownDown) requestedDir = { x: 0, y: 1 };
      } else {
        // Stationary: any pressed direction
        if (isLeftDown) requestedDir = { x: -1, y: 0 };
        else if (isRightDown) requestedDir = { x: 1, y: 0 };
        else if (isUpDown) requestedDir = { x: 0, y: -1 };
        else if (isDownDown) requestedDir = { x: 0, y: 1 };
      }
    }

    if (requestedDir) {
      sound.resumeContext();

      // First move ever in the game
      if (!this.hasMovedEver) {
        this.hasMovedEver = true;
        this.hud.hideStartupMissionMessage();

        this.tweens.add({
          targets: [this.titleOverlayContainer, this.moveHintContainer],
          alpha: 0,
          duration: 350,
          onComplete: () => {
            this.titleOverlayContainer.setVisible(false);
            this.moveHintContainer.setVisible(false);
          },
        });
      }

      // First move on this level
      if (!this.hasMovedOnceThisLevel) {
        this.hasMovedOnceThisLevel = true;
        for (const enemy of this.enemies) {
          enemy.activateAfterPlayerMove();
        }
      }

      // Smoothly fade out locked door start highlight upon moving
      if (this.doorHighlightContainer) {
        const targetHighlight = this.doorHighlightContainer;
        this.doorHighlightContainer = undefined;
        this.tweens.add({
          targets: targetHighlight,
          alpha: 0,
          duration: 450,
          onComplete: () => {
            targetHighlight.destroy();
          },
        });
      }

      this.player.requestDirection(requestedDir);
      this.idleTimeCounter = 0;
    } else {
      // Idle tracking (standing still for 4+ seconds)
      if (this.hasMovedOnceThisLevel && !this.player.isMoving) {
        this.idleTimeCounter += dtSeconds;
        if (this.idleTimeCounter >= 4.0) {
          this.idleTimeCounter = 0;
          this.hud.onStandStill();
        }
      }
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.pauseOverlayContainer.setVisible(this.isPaused);
  }

  private checkCollisions(): void {
    // 1. Check Exit Door
    if (this.player.tileX === this.exitDoorTile.x && this.player.tileY === this.exitDoorTile.y) {
      if (this.isDoorUnlocked) {
        this.completeLevel();
        return;
      } else {
        // Locked door!
        if (this.time.now > this.lockedThudCooldown) {
          this.lockedThudCooldown = this.time.now + 1200;
          sound.playDoorLockedThud();
          this.cameras.main.shake(80, 0.003);
          const needed = this.veggiesRequiredThisLevel - this.veggiesEatenThisLevel;
          this.hud.showFloatingScore(`🔒 Need ${needed} more!`, this.player.x, this.player.y, false);
          this.hud.showEncouragement(`Eat ${needed} more veggies to unlock the door!`, true);
        }
      }
    }

    // 2. Check Pellets
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if (p.tileX === this.player.tileX && p.tileY === this.player.tileY) {
        this.veggiesEatenThisLevel++;
        this.hud.setVeggieProgress(this.veggiesEatenThisLevel, this.veggiesRequiredThisLevel);

        if (!this.isDoorUnlocked && this.veggiesEatenThisLevel >= this.veggiesRequiredThisLevel) {
          this.unlockExitDoor();
        }

        // Collect pellet
        if (p.isPower) {
          this.score += SCORE_POWER_VEGGIE;
          sound.playPowerChime();

          const superfood = p.superfood || SUPERFOOD_LOOKUP['spinach'] || SUPERFOOD_VARIETIES[0];
          this.createSparkleBurst(this.player.x, this.player.y, superfood.colorHex, 22, 220);

          this.hud.showFloatingScore(`+50 ${superfood.name.toUpperCase()}!`, this.player.x, this.player.y, true);
          this.hud.showFirstEncounter(`superfood_${superfood.id}`, `${superfood.emoji} ${superfood.name}: +50 Superfood Power!`, this.player.x, this.player.y);

          // Temporarily pause the game for a couple of seconds and show the superfood card in the middle of the screen!
          this.isSuperfoodPaused = true;
          this.hud.onPowerVeggieEaten(superfood, () => {
            this.isSuperfoodPaused = false;
          });

          // Frighten enemies
          const frightenedDuration = Math.max(4.0, 6.0 - this.currentLevelIndex * 0.5);
          this.powerVeggieRemainingTimer = frightenedDuration;
          sound.setPowerMode(true);

          for (const enemy of this.enemies) {
            enemy.setFrightened(frightenedDuration);
          }
        } else {
          // Regular veggie & berry chomp with combo scaling!
          this.comboCount++;
          this.comboTimer = 2.2;
          this.score += SCORE_VEGGIE;
          sound.playVeggieBlip(this.comboCount);

          const burstColor = p.berry ? p.berry.colorHex : 0x22c55e;
          this.createSparkleBurst(this.player.x, this.player.y, burstColor, 7, 125);

          if (this.comboCount >= 5) {
            this.hud.showFloatingScore(`🔥 ${this.comboCount} STREAK!`, this.player.x, this.player.y - 12, true);
          } else if (p.berry) {
            this.hud.showFirstEncounter('veggie_' + p.berry.id, `${p.berry.emoji} ${p.berry.name} +10`, this.player.x, this.player.y);
          } else {
            this.hud.showFirstEncounter('veggie_' + p.emoji, `${p.emoji} +10`, this.player.x, this.player.y);
          }

          this.consecutiveVeggiesWithoutHit++;
          if (this.consecutiveVeggiesWithoutHit === 10) {
            this.hud.onTenVeggiesInRow();
          }

          this.hud.maybeShowVeggieFact();
        }

        this.updateScoreRecord();

        if (p.pulseTween) p.pulseTween.stop();
        p.container.destroy();
        this.pellets.splice(i, 1);
        break;
      }
    }

    // 3. Check Enemy Collisions
    const hitRadius = this.tileSize * 0.65;
    for (const enemy of this.enemies) {
      if (!enemy.isParked) {
        this.hud.showFirstEncounter(enemy.type, enemy.config.description, enemy.x, enemy.y);
      }

      if (enemy.isParked || enemy.isReturningHome) continue;

      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
      if (dist < hitRadius) {
        if (enemy.isFrightened) {
          // Player eats frightened enemy!
          this.score += SCORE_EAT_ENEMY;
          this.updateScoreRecord();
          sound.playEatEnemy();

          // Micro hit-stop + camera shake
          this.cameras.main.shake(140, 0.007);
          this.createSparkleBurst(enemy.x, enemy.y, 0xfacc15, 20, 220);

          const humorousBadges = ['−1,200 CALORIES!', 'PORTION CONTROL!', 'DETOXIFIED!', 'CLEAN RUN!'];
          const badge = humorousBadges[Math.floor(Math.random() * humorousBadges.length)];
          this.hud.showFloatingScore(badge, enemy.x, enemy.y - 18, true);
          this.hud.onFrightenedEnemyEaten();

          enemy.isReturningHome = true;
          enemy.isFrightened = false;
        } else if (!this.player.isInvincible) {
          // Player caught
          this.consecutiveVeggiesWithoutHit = 0;
          this.comboCount = 0;
          this.score -= enemy.config.penalty;
          sound.playBonk();

          // Impact camera shake & red crumb burst
          this.cameras.main.shake(160, 0.008);
          this.createSparkleBurst(this.player.x, this.player.y, 0xef4444, 14, 180);

          this.hud.showFloatingScore(`−${enemy.config.penalty}`, this.player.x, this.player.y, false);
          this.hud.onPlayerCaught();
          this.updateScoreRecord();

          if (this.score < 0 && !this.hadNegativeScoreHint) {
            this.hadNegativeScoreHint = true;
            this.hud.onScoreNegative();
          }

          if (this.score <= GAME_OVER_SCORE) {
            this.triggerGameOver();
            return;
          }

          this.player.resetToStart();
          enemy.resetToHome();
        }
      }
    }
  }

  private updateScoreRecord(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(STORAGE_KEY_BEST_SCORE, String(this.bestScore));
      } catch {}
    }
    this.hud.updateScore(this.score, this.bestScore);
  }

  private completeLevel(): void {
    this.isTransitioningLevel = true;
    sound.setPowerMode(false);
    sound.playDoorArpeggio();

    this.cameras.main.flash(350, 16, 185, 129);

    const elapsedSeconds = Math.round((this.time.now - this.levelStartTime) / 1000);
    this.totalGameTime += elapsedSeconds;

    const levelBonus = 100 * (this.currentLevelIndex + 1);
    const timeBonus = Math.max(0, (this.currentLevelDef.parTime - elapsedSeconds) * 10);
    const earnedPoints = levelBonus + timeBonus;

    this.score += earnedPoints;
    this.updateScoreRecord();

    const isLastLevel = this.currentLevelIndex === LEVELS.length - 1;

    if (isLastLevel) {
      this.triggerWin();
      return;
    }

    this.showLevelCompleteBanner(earnedPoints, elapsedSeconds);
  }

  private showLevelCompleteBanner(earnedPoints: number, elapsedSec: number): void {
    this.bannerOverlayContainer.removeAll(true);
    this.bannerOverlayContainer.setVisible(true);

    const bg = this.add.graphics();
    bg.fillStyle(0x020617, 0.92);
    bg.fillRoundedRect(-220, -90, 440, 180, 16);
    bg.lineStyle(2, 0x10b981, 0.95);
    bg.strokeRoundedRect(-220, -90, 440, 180, 16);

    const titleText = this.add.text(0, -56, `LEVEL ${this.currentLevelIndex + 1} COMPLETE!`, {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '22px',
      fontStyle: '900',
      color: '#4ade80',
    });
    titleText.setOrigin(0.5, 0.5);

    const statsText = this.add.text(0, -18, `+${earnedPoints} pts  ·  Time: ${elapsedSec}s`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      color: '#e2e8f0',
    });
    statsText.setOrigin(0.5, 0.5);

    const nextTeaser = this.currentLevelDef.teaser;
    const teaserText = this.add.text(0, 16, nextTeaser, {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: '600',
      color: '#94a3b8',
    });
    teaserText.setOrigin(0.5, 0.5);

    const countdownText = this.add.text(0, 52, 'Next maze starting...', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#38bdf8',
    });
    countdownText.setOrigin(0.5, 0.5);

    this.bannerOverlayContainer.add([bg, titleText, statsText, teaserText, countdownText]);

    this.time.delayedCall(2000, () => {
      this.bannerOverlayContainer.setVisible(false);
      this.startLevel(this.currentLevelIndex + 1);
    });
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    sound.setPowerMode(false);
    sound.playGameOver();

    const isNewBest = this.score >= this.bestScore && this.score > 0;

    this.endOverlayContainer.removeAll(true);
    this.endOverlayContainer.setVisible(true);

    const bg = this.add.graphics();
    bg.fillStyle(0x050814, 0.92);
    bg.fillRoundedRect(-220, -110, 440, 220, 16);
    bg.lineStyle(2, 0xef4444, 0.9);
    bg.strokeRoundedRect(-220, -110, 440, 220, 16);

    const titleText = this.add.text(0, -68, 'GAME OVER', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '32px',
      fontStyle: '900',
      color: '#f87171',
    });
    titleText.setOrigin(0.5, 0.5);

    const reasonText = this.add.text(0, -32, 'Sugar crash: score hit −100', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
    });
    reasonText.setOrigin(0.5, 0.5);

    const scoreDisplay = this.add.text(0, 2, `Final Score: ${this.score}`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    scoreDisplay.setOrigin(0.5, 0.5);

    const newBestText = this.add.text(0, 32, isNewBest ? '🎉 New Best Score!' : `Best: ${this.bestScore}`, {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: isNewBest ? '#fbbf24' : '#64748b',
    });
    newBestText.setOrigin(0.5, 0.5);

    const restartPrompt = this.add.text(0, 72, 'Press any arrow key to run again', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#38bdf8',
    });
    restartPrompt.setOrigin(0.5, 0.5);

    this.endOverlayContainer.add([bg, titleText, reasonText, scoreDisplay, newBestText, restartPrompt]);
  }

  private triggerWin(): void {
    this.isGameWon = true;
    sound.setPowerMode(false);
    sound.playWinFanfare();

    const isNewBest = this.score >= this.bestScore;

    this.endOverlayContainer.removeAll(true);
    this.endOverlayContainer.setVisible(true);

    const bg = this.add.graphics();
    bg.fillStyle(0x050814, 0.94);
    bg.fillRoundedRect(-230, -120, 460, 240, 16);
    bg.lineStyle(2, 0x10b981, 0.95);
    bg.strokeRoundedRect(-230, -120, 460, 240, 16);

    const titleText = this.add.text(0, -78, 'YOU ESCAPED THE BUFFET!', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '24px',
      fontStyle: '900',
      color: '#4ade80',
    });
    titleText.setOrigin(0.5, 0.5);

    const descText = this.add.text(0, -44, 'All 5 levels conquered clean.', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      color: '#94a3b8',
    });
    descText.setOrigin(0.5, 0.5);

    const scoreDisplay = this.add.text(0, -8, `Total Score: ${this.score}`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    scoreDisplay.setOrigin(0.5, 0.5);

    const timeDisplay = this.add.text(0, 24, `Total Time: ${this.totalGameTime}s`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#cbd5e1',
    });
    timeDisplay.setOrigin(0.5, 0.5);

    const bestDisplay = this.add.text(0, 50, isNewBest ? '🎉 New Best Score!' : `Best: ${this.bestScore}`, {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: isNewBest ? '#fbbf24' : '#64748b',
    });
    bestDisplay.setOrigin(0.5, 0.5);

    const restartPrompt = this.add.text(0, 84, 'Press any arrow key to run again', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#38bdf8',
    });
    restartPrompt.setOrigin(0.5, 0.5);

    this.endOverlayContainer.add([
      bg,
      titleText,
      descText,
      scoreDisplay,
      timeDisplay,
      bestDisplay,
      restartPrompt,
    ]);
  }

  private restartGame(): void {
    this.score = 0;
    this.totalGameTime = 0;
    this.isGameOver = false;
    this.isGameWon = false;
    this.isTransitioningLevel = false;
    this.hadNegativeScoreHint = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.powerVeggieRemainingTimer = 0;
    sound.setPowerMode(false);
    this.endOverlayContainer.setVisible(false);
    this.bannerOverlayContainer.setVisible(false);
    this.startLevel(0);
  }
}
