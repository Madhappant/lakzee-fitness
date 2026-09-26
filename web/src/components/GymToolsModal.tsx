"use client";

import React, { useState } from "react";
import { X, Calculator, Disc, Trophy } from "lucide-react";

interface GymToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GymToolsModal({ isOpen, onClose }: GymToolsModalProps) {
  const [activeTab, setActiveTab] = useState<"PLATES" | "1RM">("PLATES");

  // Plate Calculator State
  const [targetWeight, setTargetWeight] = useState<number>(60);
  const [barWeight, setBarWeight] = useState<number>(20);

  // 1RM Calculator State
  const [liftWeight, setLiftWeight] = useState<number>(80);
  const [liftReps, setLiftReps] = useState<number>(5);

  if (!isOpen) return null;

  // Calculate plates per side
  const calculatePlates = (target: number, bar: number) => {
    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const weightToDistribute = Math.max(0, target - bar);
    const weightPerSide = weightToDistribute / 2;

    let remaining = weightPerSide;
    const platesUsed: { weight: number; count: number }[] = [];

    for (const plate of availablePlates) {
      if (remaining >= plate) {
        const count = Math.floor(remaining / plate);
        platesUsed.push({ weight: plate, count });
        remaining = Math.round((remaining - count * plate) * 100) / 100;
      }
    }

    return {
      weightPerSide,
      platesUsed,
      remainder: remaining * 2,
    };
  };

  const plateCalcResult = calculatePlates(targetWeight, barWeight);

  // Calculate 1RM using Epley & Brzycki average
  const calculate1RM = (weight: number, reps: number) => {
    if (reps <= 0 || weight <= 0) return 0;
    if (reps === 1) return weight;
    const epley = weight * (1 + reps / 30);
    const brzycki = weight / (1.0278 - 0.0278 * reps);
    return Math.round((epley + brzycki) / 2);
  };

  const estimated1RM = calculate1RM(liftWeight, liftReps);

  const plateColors: Record<number, string> = {
    25: "bg-red-600 text-white",
    20: "bg-blue-600 text-white",
    15: "bg-yellow-500 text-black",
    10: "bg-emerald-600 text-white",
    5: "bg-white text-black border border-gray-400",
    2.5: "bg-slate-700 text-white",
    1.25: "bg-zinc-500 text-white",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Gym Performance Tools</h3>
              <p className="text-xs text-muted-foreground">Barbell plates & One-Rep Maximum calculators</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-muted/30 border-b border-border/60">
          <button
            onClick={() => setActiveTab("PLATES")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "PLATES"
                ? "bg-brand-gold text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Disc className="w-4 h-4" /> Barbell Plate Math
          </button>
          <button
            onClick={() => setActiveTab("1RM")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "1RM"
                ? "bg-brand-gold text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-4 h-4" /> One-Rep Max (1RM)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {activeTab === "PLATES" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Target Total Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="2.5"
                    min="20"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-lg font-bold text-foreground mt-1 outline-none focus:border-brand-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Barbell Weight (kg)
                  </label>
                  <select
                    value={barWeight}
                    onChange={(e) => setBarWeight(Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3.5 text-sm font-semibold text-foreground mt-1 outline-none focus:border-brand-gold"
                  >
                    <option value={20}>20 kg (Standard Olympic Bar)</option>
                    <option value={15}>15 kg (Women Olympic Bar)</option>
                    <option value={10}>10 kg (EZ Curl Bar)</option>
                    <option value={0}>0 kg (Smith Machine / No Bar)</option>
                  </select>
                </div>
              </div>

              {/* Plate Loading Visual Display */}
              <div className="p-5 rounded-2xl bg-muted/20 border border-border/70 text-center space-y-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Load On Each Side:
                </div>
                <div className="text-3xl font-black text-brand-gold">
                  {plateCalcResult.weightPerSide} kg{" "}
                  <span className="text-sm font-normal text-muted-foreground">per side</span>
                </div>

                {plateCalcResult.platesUsed.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {plateCalcResult.platesUsed.map((p, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 ${
                          plateColors[p.weight] || "bg-slate-700 text-white"
                        }`}
                      >
                        <Disc className="w-3.5 h-3.5" />
                        <span>{p.weight} kg</span>
                        <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[10px]">
                          × {p.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Target weight matches or is less than the empty barbell.
                  </div>
                )}

                {plateCalcResult.remainder > 0 && (
                  <div className="text-[11px] text-amber-500 font-medium">
                    Note: Remaining {plateCalcResult.remainder} kg cannot be evenly divided with standard plates.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Weight Lifted (kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={liftWeight}
                    onChange={(e) => setLiftWeight(Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-lg font-bold text-foreground mt-1 outline-none focus:border-brand-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Reps Performed
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={liftReps}
                    onChange={(e) => setLiftReps(Number(e.target.value))}
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-lg font-bold text-foreground mt-1 outline-none focus:border-brand-gold"
                  />
                </div>
              </div>

              {/* 1RM Result Display */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-gold/15 to-transparent border border-brand-gold/30 text-center space-y-2">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Estimated 1-Rep Max:
                </div>
                <div className="text-4xl font-black text-brand-gold">{estimated1RM} kg</div>
                <p className="text-xs text-muted-foreground">
                  Based on Epley & Brzycki formula average.
                </p>
              </div>

              {/* Training Percentages Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 text-left">% of 1RM</th>
                      <th className="py-2.5 px-4 text-center">Reps Range</th>
                      <th className="py-2.5 px-4 text-right">Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-foreground">
                    {[
                      { pct: 100, reps: "1 RM", w: estimated1RM },
                      { pct: 95, reps: "2 RM", w: Math.round(estimated1RM * 0.95) },
                      { pct: 90, reps: "3-4 RM", w: Math.round(estimated1RM * 0.9) },
                      { pct: 85, reps: "5-6 RM", w: Math.round(estimated1RM * 0.85) },
                      { pct: 80, reps: "7-8 RM", w: Math.round(estimated1RM * 0.8) },
                      { pct: 75, reps: "9-10 RM", w: Math.round(estimated1RM * 0.75) },
                      { pct: 70, reps: "11-12 RM", w: Math.round(estimated1RM * 0.7) },
                    ].map((row) => (
                      <tr key={row.pct} className="hover:bg-muted/20">
                        <td className="py-2 px-4 font-bold text-brand-gold">{row.pct}%</td>
                        <td className="py-2 px-4 text-center text-muted-foreground">{row.reps}</td>
                        <td className="py-2 px-4 text-right font-semibold">{row.w} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
