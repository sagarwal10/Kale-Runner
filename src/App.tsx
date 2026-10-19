/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './game/constants';
import { KaleRunnerScene } from './game/KaleRunnerScene';
import { sound } from './game/audio';
import { Volume2, VolumeX, Pause, Play, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [showTouchControls, setShowTouchControls] = useState<boolean>(false);

  useEffect(() => {
    // Detect touch device
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setShowTouchControls(isTouch);

    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#080d1a',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [KaleRunnerScene],
      render: {
        antialias: true,
        pixelArt: false,
      },
      input: {
        keyboard: true,
      },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default page scrolling on arrows
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyM') {
        setTimeout(() => setIsMuted(sound.getMuted()), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const handleMuteToggle = () => {
    sound.resumeContext();
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handlePauseToggle = () => {
    sound.resumeContext();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }));
  };

  const sendVirtualKey = (key: string, code: string) => {
    sound.resumeContext();
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
  };

  return (
    <div className="relative w-screen h-screen bg-[#070b16] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Top Floating Controls Bar */}
      <header className="absolute top-2 right-4 z-40 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={handlePauseToggle}
          title="Pause / Resume (P)"
          aria-label="Pause or resume"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-emerald-500/60 transition text-xs font-mono backdrop-blur-sm cursor-pointer shadow-lg"
        >
          <Pause className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pause [P]</span>
        </button>

        <button
          onClick={handleMuteToggle}
          title="Toggle Mute (M)"
          aria-label="Toggle mute"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-emerald-500/60 transition text-xs font-mono backdrop-blur-sm cursor-pointer shadow-lg"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline text-rose-400">Muted [M]</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sound [M]</span>
            </>
          )}
        </button>
      </header>

      {/* Phaser Canvas Mounting Container */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden p-0 m-0"
      />

      {/* Optional On-Screen D-Pad for Touch/Mobile Users */}
      {showTouchControls && (
        <div className="absolute bottom-4 right-4 z-40 flex flex-col items-center gap-1 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              sendVirtualKey('ArrowUp', 'ArrowUp');
            }}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 active:bg-emerald-600 active:text-white shadow"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                sendVirtualKey('ArrowLeft', 'ArrowLeft');
              }}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 active:bg-emerald-600 active:text-white shadow"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                sendVirtualKey('ArrowDown', 'ArrowDown');
              }}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 active:bg-emerald-600 active:text-white shadow"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                sendVirtualKey('ArrowRight', 'ArrowRight');
              }}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 active:bg-emerald-600 active:text-white shadow"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
