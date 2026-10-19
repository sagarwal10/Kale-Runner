/**
 * Web Audio API synthesizer for Kale Runner
 * Generates all sound effects, combo pitch scaling, and adaptive synth bassline procedurally.
 */

import { STORAGE_KEY_MUTED } from './constants';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Background procedural synth groove
  private isBgmPlaying: boolean = false;
  private bgmTimer: number | null = null;
  private bgmStep: number = 0;
  private isPowerMode: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MUTED);
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.28, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
    }
  }

  public resumeContext(): void {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isBgmPlaying && !this.isMuted) {
      this.startBgm();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(this.isMuted));
    } catch {}

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.28, this.ctx.currentTime);
    }

    if (this.isMuted) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setPowerMode(active: boolean): void {
    this.isPowerMode = active;
  }

  /**
   * Procedural low-fi arcade synth bass groove
   */
  private startBgm(): void {
    if (this.isBgmPlaying || this.isMuted) return;
    this.isBgmPlaying = true;
    this.scheduleNextBgmBeat();
  }

  private stopBgm(): void {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      window.clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private scheduleNextBgmBeat(): void {
    if (!this.isBgmPlaying || this.isMuted) return;

    // Bass note progression (F minor / Pentatonic cool arcade groove)
    const baseNotes = [87.31, 87.31, 116.54, 87.31, 103.83, 87.31, 130.81, 116.54];
    const powerNotes = [116.54, 130.81, 146.83, 174.61, 116.54, 146.83, 174.61, 196.0];

    const notes = this.isPowerMode ? powerNotes : baseNotes;
    const freq = notes[this.bgmStep % notes.length];
    this.bgmStep++;

    this.playBassPluck(freq);

    // BPM: 112 normal, 138 during power veggie mode
    const intervalMs = this.isPowerMode ? 217 : 268;
    this.bgmTimer = window.setTimeout(() => {
      this.scheduleNextBgmBeat();
    }, intervalMs);
  }

  private playBassPluck(freq: number): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = this.isPowerMode ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.isPowerMode ? 650 : 380, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 0.16);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.19);
    } catch {}
  }

  /**
   * Soft blip for eating a small veggie with combo pitch scaling
   */
  public playVeggieBlip(combo: number = 0): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Ascends with combo count (+15Hz per combo up to 25)
      const baseFreq = 760 + Math.min(25, combo) * 22;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, t + 0.035);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);
    } catch {}
  }

  /**
   * Rising crystalline chime for power veggie (+50)
   */
  public playPowerChime(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const noteStart = now + idx * 0.045;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(0.24, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteStart);
        osc.stop(noteStart + 0.17);
      });
    } catch {}
  }

  /**
   * Heavy punchy arcade crunch when eating a frightened enemy
   */
  public playEatEnemy(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;

      // Sub-bass impact
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(160, t);
      subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      subGain.gain.setValueAtTime(0.35, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(t);
      subOsc.stop(t + 0.18);

      // Bright arcade chew sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.14);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.32, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.17);
    } catch {}
  }

  /**
   * Deep "bonk" when caught by an active enemy
   */
  public playBonk(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.linearRampToValueAtTime(120, t + 0.22);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch {}
  }

  /**
   * Sound played when veggie quota is reached and exit door unlocks
   */
  public playDoorUnlocked(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const start = now + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch {}
  }

  /**
   * Short low thud when bumping into a locked door
   */
  public playDoorLockedThud(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    } catch {}
  }

  /**
   * Cheerful celebratory arpeggio when reaching the exit door
   */
  public playDoorArpeggio(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const chord = [698.46, 880.0, 1046.5, 1396.91];
      const now = this.ctx.currentTime;

      chord.forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const start = now + i * 0.065;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {}
  }

  /**
   * Short sad tone on Game Over
   */
  public playGameOver(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [392.0, 369.99, 329.63, 277.18];

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const start = now + idx * 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.24, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {}
  }

  /**
   * Victorious completion chime on Level 5 win
   */
  public playWinFanfare(): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const start = now + idx * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(start);
        osc.stop(start + 0.38);
      });
    } catch {}
  }
}

export const sound = new SoundEngine();
