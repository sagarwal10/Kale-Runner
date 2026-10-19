/**
 * HUD, Progress Bar, and Toast / Encouragement / Mission Banner Manager
 */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, HUD_HEIGHT, SuperfoodDef, SUPERFOOD_LOOKUP } from './constants';

export const VEGGIE_FACTS = [
  'Carrots: beta-carotene converts to vitamin A for healthy night vision.',
  'Blueberries: rich in anthocyanin polyphenols that sharpen focus & reflexes.',
  'Raspberries: 8g of prebiotic dietary fiber per cup & cell-protecting ellagitannins.',
  'Blackberries: packed with bioflavonoids and vitamin K for brain cell agility.',
  'Strawberries: more Vitamin C per serving than oranges, supporting cardiovascular stamina.',
  'Broccoli: contains sulforaphane that triggers natural cellular defenses.',
  'Spinach was favored by Roman gladiators for nitrates that aid blood circulation.',
  'Avocados are rich in monounsaturated fats that nourish heart & brain tissue.',
  'Kale provides over 100% of your daily vitamin K in a single crisp cup.',
  'Peas are legume powerhouses loaded with clean plant protein and fiber.',
];

export const CAUGHT_QUOTES = [
  'Resist the donut.',
  'Shake it off. Keep going.',
  "Cheat day's over. Move.",
];

export class HUDManager {
  private scene: Phaser.Scene;

  // Background and bar graphics
  private hudBg: Phaser.GameObjects.Graphics;
  private progressGraphics: Phaser.GameObjects.Graphics;

  // HUD text labels
  private brandBadgeContainer: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private bestText: Phaser.GameObjects.Text;
  private progressLabel: Phaser.GameObjects.Text;
  private bottomHelpText: Phaser.GameObjects.Text;

  // Progress interpolation
  private currentProgressVal: number = 0;
  private targetProgressVal: number = 0;
  private isDoorUnlocked: boolean = false;

  // Hint / Encouragement system
  private hintContainer: Phaser.GameObjects.Container;
  private hintBg: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text;
  private isHintActive: boolean = false;
  private hintCooldownTimer: number = 0; // must be >= 6s between hints
  private lastFactTimer: number = 0; // at most once every 15s

  // Startup mission banner container
  private missionContainer: Phaser.GameObjects.Container;

  // Tracking triggered one-time events per level or per game
  private triggered50: boolean = false;
  private triggeredUnlocked: boolean = false;
  private caughtQuoteIndex: number = 0;
  private factIndex: number = 0;

  // Encounter labels set
  private seenEncounters: Set<string> = new Set();

  // Active centered superfood card container, timer, and resume callback
  private activeSuperfoodCardContainer?: Phaser.GameObjects.Container;
  private activeSuperfoodTimerEvent?: Phaser.Time.TimerEvent;
  private onSuperfoodCardDismiss?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Top HUD bar background
    this.hudBg = scene.add.graphics();
    this.hudBg.setDepth(50);
    this.hudBg.setScrollFactor(0);
    this.drawHudBackground();

    // Persistent KALE RUNNER brand badge (Left)
    this.brandBadgeContainer = scene.add.container(24, 18);
    this.brandBadgeContainer.setDepth(52);
    this.brandBadgeContainer.setScrollFactor(0);

    const brandBg = scene.add.graphics();
    brandBg.fillStyle(0x022c22, 0.9);
    brandBg.fillRoundedRect(0, 0, 142, 28, 8);
    brandBg.lineStyle(1.5, 0x10b981, 0.8);
    brandBg.strokeRoundedRect(0, 0, 142, 28, 8);

    const brandText = scene.add.text(71, 14, '🥬 KALE RUNNER', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: '900',
      color: '#4ade80',
    });
    brandText.setOrigin(0.5, 0.5);

    this.brandBadgeContainer.add([brandBg, brandText]);

    // Score text (Next to Brand badge)
    this.scoreText = scene.add.text(182, 22, 'Score: 0', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    this.scoreText.setDepth(52);
    this.scoreText.setScrollFactor(0);

    // Progress bar graphics
    this.progressGraphics = scene.add.graphics();
    this.progressGraphics.setDepth(51);
    this.progressGraphics.setScrollFactor(0);

    // Progress label (Center)
    this.progressLabel = scene.add.text(CANVAS_WIDTH / 2, 44, 'Veggies: 0/15 (0%)', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#94a3b8',
    });
    this.progressLabel.setOrigin(0.5, 0.5);
    this.progressLabel.setDepth(52);
    this.progressLabel.setScrollFactor(0);

    // Level & Best score (Right)
    this.levelText = scene.add.text(CANVAS_WIDTH - 24, 16, 'Level 1/5', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });
    this.levelText.setOrigin(1, 0);
    this.levelText.setDepth(52);
    this.levelText.setScrollFactor(0);

    this.bestText = scene.add.text(CANVAS_WIDTH - 24, 38, 'Best: 0', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: '#94a3b8',
    });
    this.bestText.setOrigin(1, 0);
    this.bestText.setDepth(52);
    this.bestText.setScrollFactor(0);

    // Bottom edge help text
    this.bottomHelpText = scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT - 14,
      'Arrow keys move   ·   🍃 Superfoods trigger Power Mode   ·   P pause   ·   M mute',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#64748b',
      }
    );
    this.bottomHelpText.setOrigin(0.5, 0.5);
    this.bottomHelpText.setDepth(52);
    this.bottomHelpText.setScrollFactor(0);

    // Encouragement hint popup container
    this.hintContainer = scene.add.container(CANVAS_WIDTH / 2, HUD_HEIGHT + 24);
    this.hintContainer.setDepth(60);
    this.hintContainer.setScrollFactor(0);
    this.hintContainer.setAlpha(0);

    this.hintBg = scene.add.graphics();
    this.hintContainer.add(this.hintBg);

    this.hintText = scene.add.text(0, 0, '', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '13px',
      fontStyle: '600',
      color: '#f1f5f9',
      align: 'center',
    });
    this.hintText.setOrigin(0.5, 0.5);
    this.hintContainer.add(this.hintText);

    // Startup Mission disappearing message container (Centered on screen)
    this.missionContainer = scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.missionContainer.setDepth(90);
    this.missionContainer.setScrollFactor(0);
    this.missionContainer.setAlpha(0);
    this.buildMissionContainer();
  }

  private drawHudBackground(): void {
    this.hudBg.clear();
    this.hudBg.fillStyle(0x0a0f1d, 0.95);
    this.hudBg.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    this.hudBg.lineStyle(1.5, 0x1e293b, 1.0);
    this.hudBg.lineBetween(0, HUD_HEIGHT, CANVAS_WIDTH, HUD_HEIGHT);
  }

  private buildMissionContainer(): void {
    const cardWidth = 760;
    const cardHeight = 236;

    const bg = this.scene.add.graphics();
    // Glassy dark backdrop with dual neon stroke
    bg.fillStyle(0x020617, 0.96);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);

    // Cyan outer glow
    bg.lineStyle(6, 0x06b6d4, 0.28);
    bg.strokeRoundedRect(-cardWidth / 2 - 2, -cardHeight / 2 - 2, cardWidth + 4, cardHeight + 4, 22);

    // Laser emerald inner border
    bg.lineStyle(2.5, 0x10b981, 0.95);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);

    // Tag / Badge on top
    const tag = this.scene.add.text(0, -82, '🥬 KALE RUNNER  ·  HOW TO PLAY', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '12px',
      fontStyle: '900',
      color: '#34d399',
    });
    tag.setOrigin(0.5, 0.5);

    // Big Main Message (Headline)
    const mainHeadline = this.scene.add.text(0, -42, 'Eat Veggies to Unlock the Door! 🚪', {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '28px',
      fontStyle: '900',
      color: '#4ade80',
      stroke: '#052e16',
      strokeThickness: 5,
    });
    mainHeadline.setOrigin(0.5, 0.5);

    // Subtitle warning about pizza & donuts
    const subText = this.scene.add.text(
      0,
      -2,
      'Avoid the unhealthy foods chasing you like pizza 🍕 and donuts 🍩',
      {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f1f5f9',
      }
    );
    subText.setOrigin(0.5, 0.5);

    // Explicit instruction to head to the locked door once unlocked
    const doorInstruction = this.scene.add.text(
      0,
      36,
      '🔒 Look for the highlighted Locked Door — head there after eating veggies to escape!',
      {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fbbf24',
      }
    );
    doorInstruction.setOrigin(0.5, 0.5);

    // Call to action
    const startHint = this.scene.add.text(0, 76, 'Use Arrow Keys or WASD to move & begin running', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });
    startHint.setOrigin(0.5, 0.5);

    this.missionContainer.add([bg, tag, mainHeadline, subText, doorInstruction, startHint]);
  }

  /**
   * Show the startup mission disappearing message (Big & Centered)
   */
  public showStartupMissionMessage(): void {
    this.scene.tweens.killTweensOf(this.missionContainer);
    this.missionContainer.setPosition(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.missionContainer.setScale(0.86);
    this.missionContainer.setAlpha(0);
    this.missionContainer.setVisible(true);

    this.scene.tweens.add({
      targets: this.missionContainer,
      alpha: 1,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Auto-fade after 5.5 seconds if player hasn't moved yet
        this.scene.time.delayedCall(5500, () => {
          this.hideStartupMissionMessage();
        });
      },
    });
  }

  public hideStartupMissionMessage(): void {
    if (!this.missionContainer.visible) return;
    this.scene.tweens.add({
      targets: this.missionContainer,
      alpha: 0,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 350,
      ease: 'Power2',
      onComplete: () => {
        this.missionContainer.setVisible(false);
      },
    });
  }

  public resetLevelTriggers(): void {
    this.triggered50 = false;
    this.triggeredUnlocked = false;
    this.isDoorUnlocked = false;
    this.currentProgressVal = 0;
    this.targetProgressVal = 0;
  }

  public updateScore(score: number, bestScore: number): void {
    this.scoreText.setText(`Score: ${score}`);
    if (score < 0) {
      this.scoreText.setColor('#ef4444');
    } else {
      this.scoreText.setColor('#f8fafc');
    }
    this.bestText.setText(`Best: ${bestScore}`);
  }

  public updateLevel(current: number, total: number = 5): void {
    this.levelText.setText(`Level ${current}/${total}`);
  }

  /**
   * Veggie quota progress towards unlocking the door
   */
  public setVeggieProgress(eaten: number, required: number): void {
    const ratio = Math.max(0, Math.min(1, eaten / required));
    this.targetProgressVal = ratio;

    if (eaten >= required) {
      this.isDoorUnlocked = true;
      this.progressLabel.setText(`🚪 DOOR UNLOCKED! (${eaten}/${required})`);
      this.progressLabel.setColor('#4ade80');

      if (!this.triggeredUnlocked) {
        this.triggeredUnlocked = true;
        this.showEncouragement('Door is unlocked! Make a run for it! 🚪', true);
      }
    } else {
      this.isDoorUnlocked = false;
      const pct = Math.round(ratio * 100);
      this.progressLabel.setText(`Veggies: ${eaten}/${required} (${pct}%)`);
      this.progressLabel.setColor('#94a3b8');

      if (ratio >= 0.5 && !this.triggered50) {
        this.triggered50 = true;
        this.showEncouragement('Halfway to unlocking the door! Keep going.');
      }
    }
  }

  public update(dtSeconds: number): void {
    if (this.hintCooldownTimer > 0) {
      this.hintCooldownTimer -= dtSeconds;
    }
    this.lastFactTimer += dtSeconds;

    // Smooth progress bar lerp
    this.currentProgressVal +=
      (this.targetProgressVal - this.currentProgressVal) * Math.min(1, dtSeconds * 8);

    this.renderProgressBar();
  }

  private renderProgressBar(): void {
    const barWidth = 260;
    const barHeight = 8;
    const barX = (CANVAS_WIDTH - barWidth) / 2;
    const barY = 20;

    this.progressGraphics.clear();

    // Background track
    this.progressGraphics.fillStyle(0x1e293b, 1.0);
    this.progressGraphics.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

    const fillWidth = Math.max(0, Math.min(barWidth, barWidth * this.currentProgressVal));

    if (fillWidth > 0) {
      if (this.isDoorUnlocked) {
        // Glowing bright green when unlocked!
        this.progressGraphics.fillStyle(0x22c55e, 1.0);
        this.progressGraphics.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
      } else {
        // Shifting from orange (#f97316) to bright green
        const ratio = this.currentProgressVal;
        const r = Math.round(249 + (34 - 249) * ratio);
        const g = Math.round(115 + (197 - 115) * ratio);
        const b = Math.round(22 + (94 - 22) * ratio);
        const hexColor = (r << 16) | (g << 8) | b;

        this.progressGraphics.fillStyle(hexColor, 1.0);
        this.progressGraphics.fillRoundedRect(barX, barY, fillWidth, barHeight, 4);
      }
    }
  }

  public showEncouragement(msg: string, force: boolean = false): void {
    if (this.isHintActive && !force) return;
    if (this.hintCooldownTimer > 0 && !force) return;

    this.isHintActive = true;
    this.hintCooldownTimer = 6.0;
    this.hintText.setText(msg);

    const paddingX = 18;
    const paddingY = 8;
    const width = this.hintText.width + paddingX * 2;
    const height = this.hintText.height + paddingY * 2;

    this.hintBg.clear();
    this.hintBg.fillStyle(0x0f172a, 0.94);
    this.hintBg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    this.hintBg.lineStyle(1.5, 0x10b981, 0.85);
    this.hintBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);

    this.scene.tweens.killTweensOf(this.hintContainer);
    this.hintContainer.setAlpha(0);

    this.scene.tweens.add({
      targets: this.hintContainer,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.scene.time.delayedCall(2500, () => {
          this.scene.tweens.add({
            targets: this.hintContainer,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => {
              this.isHintActive = false;
            },
          });
        });
      },
    });
  }

  public onPlayerCaught(): void {
    const quote = CAUGHT_QUOTES[this.caughtQuoteIndex % CAUGHT_QUOTES.length];
    this.caughtQuoteIndex++;
    this.showEncouragement(quote, true);
  }

  public onScoreNegative(): void {
    this.showEncouragement('Rough patch. Keep going.');
  }

  public onStandStill(): void {
    this.showEncouragement("Arrow keys. You've got this.");
  }

  public onPowerVeggieEaten(superfoodOrEmoji: SuperfoodDef | string = '🥬', onResume?: () => void): void {
    let superfood: SuperfoodDef | undefined;
    if (typeof superfoodOrEmoji === 'object' && superfoodOrEmoji !== null) {
      superfood = superfoodOrEmoji;
    } else if (typeof superfoodOrEmoji === 'string') {
      superfood = SUPERFOOD_LOOKUP[superfoodOrEmoji];
    }

    if (superfood) {
      this.showSuperfoodCard(superfood, 2.5, onResume);
    } else if (onResume) {
      onResume();
    }
  }

  /**
   * Displays the Superfood benefits card in the center of the screen
   * while the game is temporarily paused for a couple of seconds.
   */
  public showSuperfoodCard(
    superfood: SuperfoodDef,
    durationSeconds: number = 2.5,
    onComplete?: () => void
  ): void {
    // If an existing card is active, dismiss it cleanly first
    this.dismissSuperfoodCard();

    this.onSuperfoodCardDismiss = onComplete;

    // Full screen overlay + centered card container
    const cardContainer = this.scene.add.container(0, 0);
    cardContainer.setDepth(120);
    cardContainer.setScrollFactor(0);

    // 1. Semi-transparent backdrop overlay to dim game and spotlight the card
    const backdrop = this.scene.add.graphics();
    backdrop.fillStyle(0x020617, 0.68);
    backdrop.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
    // Allow clicking anywhere to dismiss and resume immediately if desired
    backdrop.on('pointerdown', () => this.dismissSuperfoodCard());
    cardContainer.add(backdrop);

    // 2. Centered Card Dimensions
    const cardW = 470;
    const cardH = 296;
    const cardX = (CANVAS_WIDTH - cardW) / 2;
    const cardY = (CANVAS_HEIGHT - cardH) / 2;

    const cardBox = this.scene.add.graphics();
    // Card dark navy background
    cardBox.fillStyle(0x09111e, 0.98);
    cardBox.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    // Outer crisp accent border in superfood color
    cardBox.lineStyle(2.5, superfood.colorHex, 0.95);
    cardBox.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    // Subtle outer glow halo
    cardBox.lineStyle(1.2, superfood.glowColor, 0.35);
    cardBox.strokeRoundedRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4, 18);
    cardContainer.add(cardBox);

    // 3. Top badge pill: "⚡ SUPERFOOD BOOST ACTIVATED"
    const pillW = 236;
    const pillH = 22;
    const pillX = cardX + (cardW - pillW) / 2;
    const pillY = cardY + 16;

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(superfood.glowColor, 0.18);
    badgeBg.fillRoundedRect(pillX, pillY, pillW, pillH, 11);
    badgeBg.lineStyle(1, superfood.colorHex, 0.7);
    badgeBg.strokeRoundedRect(pillX, pillY, pillW, pillH, 11);

    const badgeText = this.scene.add.text(
      pillX + pillW / 2,
      pillY + pillH / 2,
      '⚡ SUPERFOOD BOOST ACTIVATED',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9.5px',
        fontStyle: 'bold',
        color: superfood.textColor,
      }
    );
    badgeText.setOrigin(0.5, 0.5);
    cardContainer.add([badgeBg, badgeText]);

    // 4. Header: Large Emoji / Custom Illustration + Superfood Name + Subtitle
    if (superfood.id === 'cauliflower') {
      const cauliIcon = this.scene.add.graphics();
      const cx = cardX + 46;
      const cy = cardY + 70;
      // Leaf base
      cauliIcon.fillStyle(0x22c55e, 0.95);
      cauliIcon.fillCircle(cx - 9, cy + 4, 7.5);
      cauliIcon.fillCircle(cx + 9, cy + 4, 7.5);
      cauliIcon.fillCircle(cx, cy + 10, 8);
      // Crisp white cauliflower head
      cauliIcon.fillStyle(0xffffff, 1.0);
      cauliIcon.fillCircle(cx, cy - 6, 11);
      cauliIcon.fillCircle(cx - 8, cy - 1, 9.5);
      cauliIcon.fillCircle(cx + 8, cy - 1, 9.5);
      cauliIcon.fillCircle(cx - 5, cy + 5, 9);
      cauliIcon.fillCircle(cx + 5, cy + 5, 9);
      cauliIcon.fillCircle(cx, cy + 1, 9.5);
      // Fluffy texture shading
      cauliIcon.fillStyle(0xe2e8f0, 0.75);
      cauliIcon.fillCircle(cx - 3.5, cy - 7, 3.5);
      cauliIcon.fillCircle(cx + 4, cy - 4.5, 3.5);
      cauliIcon.fillCircle(cx, cy + 2, 3.5);
      cardContainer.add(cauliIcon);
    } else {
      const emojiText = this.scene.add.text(
        cardX + 28,
        cardY + 52,
        superfood.emoji,
        { fontSize: '34px' }
      );
      emojiText.setOrigin(0, 0);
      cardContainer.add(emojiText);
    }

    const titleText = this.scene.add.text(
      cardX + 76,
      cardY + 52,
      superfood.name.toUpperCase(),
      {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: '22px',
        fontStyle: '900',
        color: superfood.textColor,
      }
    );

    const subtitleText = this.scene.add.text(
      cardX + 78,
      cardY + 79,
      superfood.badge.toUpperCase(),
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#94a3b8',
      }
    );
    cardContainer.add([titleText, subtitleText]);

    // 5. Divider Line
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x1e293b, 0.9);
    divider.lineBetween(cardX + 24, cardY + 106, cardX + cardW - 24, cardY + 106);
    cardContainer.add(divider);

    // 6. Benefits List (Bullet Points)
    let benefitY = cardY + 120;
    for (const benefit of superfood.benefits) {
      const bulletSymbol = superfood.id === 'cauliflower' ? '🤍' : (superfood.id === 'broccoli' ? '🥦' : '🌿');
      const bullet = this.scene.add.text(cardX + 26, benefitY, bulletSymbol, {
        fontSize: '12px',
      });

      const bText = this.scene.add.text(cardX + 48, benefitY + 1, benefit, {
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: '11.5px',
        fontStyle: '600',
        color: '#f8fafc',
        wordWrap: { width: cardW - 74 },
      });
      cardContainer.add([bullet, bText]);
      benefitY += Math.max(26, bText.height + 8);
    }

    // 7. Footer: Pause Status & Shrinking Progress Bar
    const footerY = cardY + cardH - 38;

    const pauseInfoText = this.scene.add.text(
      CANVAS_WIDTH / 2,
      footerY,
      `⏸️ GAME PAUSED · Resuming in ${durationSeconds}s  (or press SPACE / click)`,
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#38bdf8',
        align: 'center',
      }
    );
    pauseInfoText.setOrigin(0.5, 0.5);
    cardContainer.add(pauseInfoText);

    // Progress bar indicating remaining pause time
    const pBarW = cardW - 48;
    const pBarH = 4;
    const pBarX = cardX + 24;
    const pBarY = cardY + cardH - 18;

    const pBarTrack = this.scene.add.graphics();
    pBarTrack.fillStyle(0x1e293b, 0.95);
    pBarTrack.fillRoundedRect(pBarX, pBarY, pBarW, pBarH, 2);
    cardContainer.add(pBarTrack);

    const pBarFill = this.scene.add.graphics();
    cardContainer.add(pBarFill);

    const totalDurationMs = durationSeconds * 1000;

    // Smooth counter to animate progress bar shrinking
    const progressTween = this.scene.tweens.addCounter({
      from: 1.0,
      to: 0.0,
      duration: totalDurationMs,
      onUpdate: (tw) => {
        const val = tw.getValue() ?? 0;
        pBarFill.clear();
        pBarFill.fillStyle(superfood.colorHex, 0.95);
        pBarFill.fillRoundedRect(pBarX, pBarY, pBarW * val, pBarH, 2);
      },
    });

    // Gentle fade-in for the card
    cardContainer.setAlpha(0);
    this.scene.tweens.add({
      targets: cardContainer,
      alpha: 1,
      duration: 180,
      ease: 'Power2',
    });

    this.activeSuperfoodCardContainer = cardContainer;

    // Auto-dismiss after durationSeconds
    this.activeSuperfoodTimerEvent = this.scene.time.delayedCall(totalDurationMs, () => {
      progressTween.stop();
      this.dismissSuperfoodCard();
    });
  }

  public dismissSuperfoodCard(): void {
    if (this.activeSuperfoodTimerEvent) {
      this.activeSuperfoodTimerEvent.remove();
      this.activeSuperfoodTimerEvent = undefined;
    }

    if (this.activeSuperfoodCardContainer) {
      const containerToDestroy = this.activeSuperfoodCardContainer;
      this.activeSuperfoodCardContainer = undefined;

      this.scene.tweens.add({
        targets: containerToDestroy,
        alpha: 0,
        duration: 160,
        ease: 'Power2',
        onComplete: () => {
          containerToDestroy.destroy();
        },
      });
    }

    if (this.onSuperfoodCardDismiss) {
      const cb = this.onSuperfoodCardDismiss;
      this.onSuperfoodCardDismiss = undefined;
      cb();
    }
  }

  public isSuperfoodCardShowing(): boolean {
    return this.activeSuperfoodCardContainer !== undefined;
  }

  public onFrightenedEnemyEaten(): void {
    this.showEncouragement('Portion control: achieved.');
  }

  public onTenVeggiesInRow(): void {
    this.showEncouragement('Your cardiologist is proud.');
  }

  public maybeShowVeggieFact(): void {
    if (this.isHintActive || this.lastFactTimer < 15) return;
    this.lastFactTimer = 0;
    const fact = VEGGIE_FACTS[this.factIndex % VEGGIE_FACTS.length];
    this.factIndex++;
    this.showEncouragement(fact);
  }

  public showFirstEncounter(id: string, text: string, worldX: number, worldY: number): void {
    if (this.seenEncounters.has(id)) return;
    this.seenEncounters.add(id);

    const encounterContainer = this.scene.add.container(worldX, worldY - 26);
    encounterContainer.setDepth(65);

    const labelText = this.scene.add.text(0, 0, text, {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    labelText.setOrigin(0.5, 0.5);

    const bg = this.scene.add.graphics();
    const padX = 10;
    const padY = 5;
    const w = labelText.width + padX * 2;
    const h = labelText.height + padY * 2;

    bg.fillStyle(0x0f172a, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(1, 0x38bdf8, 0.8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

    encounterContainer.add([bg, labelText]);

    this.scene.tweens.add({
      targets: encounterContainer,
      y: worldY - 38,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1900, () => {
          this.scene.tweens.add({
            targets: encounterContainer,
            alpha: 0,
            duration: 350,
            onComplete: () => {
              encounterContainer.destroy();
            },
          });
        });
      },
    });
  }

  public showFloatingScore(text: string, worldX: number, worldY: number, isPositive: boolean): void {
    const color = isPositive ? '#4ade80' : '#f87171';
    const floatText = this.scene.add.text(worldX, worldY, text, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color,
    });
    floatText.setOrigin(0.5, 0.5);
    floatText.setDepth(70);

    this.scene.tweens.add({
      targets: floatText,
      y: worldY - 26,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        floatText.destroy();
      },
    });
  }

  public destroy(): void {
    this.hudBg.destroy();
    this.brandBadgeContainer.destroy();
    this.progressGraphics.destroy();
    this.scoreText.destroy();
    this.levelText.destroy();
    this.bestText.destroy();
    this.progressLabel.destroy();
    this.bottomHelpText.destroy();
    this.hintContainer.destroy();
    this.missionContainer.destroy();
    this.dismissSuperfoodCard();
  }
}
