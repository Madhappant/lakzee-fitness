"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, Plus, Minus, Bell } from "lucide-react";

interface RestTimerProps {
  initialSeconds?: number;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  exerciseName?: string;
}

export default function RestTimer({
  initialSeconds = 60,
  isOpen,
  onClose,
  onComplete,
  exerciseName,
}: RestTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Store information from previous renders without setState in effect
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setTotalSeconds(initialSeconds);
      setSecondsLeft(initialSeconds);
      setIsActive(true);
    }
  }

  // Play audio chime using Web Audio API (cross-browser, no audio files needed)
  const playBeep = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio might be blocked by browser policy until interaction
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined = undefined;
    if (isOpen && isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            playBeep();
            if (onComplete) onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isActive, secondsLeft, onComplete]);

  if (!isOpen) return null;

  const progressPct = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const minutes = Math.floor(secondsLeft / 60);
  const remainderSeconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}`;

  const adjustTime = (amount: number) => {
    setSecondsLeft((prev) => {
      const next = Math.max(5, prev + amount);
      if (next > totalSeconds) setTotalSeconds(next);
      return next;
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card/95 backdrop-blur-xl border border-brand-gold/40 shadow-[0_10px_35px_rgba(0,0,0,0.5)] rounded-2xl p-4 text-foreground">
        {/* Progress bar */}
        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-brand-gold to-yellow-400 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-bold">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="text-2xl font-black font-mono tracking-wider text-brand-gold">
                {formattedTime}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[130px]">
                {exerciseName ? `Rest after ${exerciseName}` : "Rest Timer"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => adjustTime(-15)}
              className="px-2 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-0.5"
              title="-15 seconds"
            >
              <Minus className="w-3 h-3" />15s
            </button>
            <button
              onClick={() => adjustTime(15)}
              className="px-2 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-0.5"
              title="+15 seconds"
            >
              <Plus className="w-3 h-3" />15s
            </button>
            <button
              onClick={() => setIsActive(!isActive)}
              className="p-2 rounded-lg bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold transition-all"
              title={isActive ? "Pause" : "Resume"}
            >
              {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-brand-gold text-white hover:bg-brand-gold/90 text-xs font-bold transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
