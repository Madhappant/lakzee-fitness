/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useMemo } from "react";
import exercisesData from "@/data/exercises.json";
import { Search, X, Dumbbell, ChevronRight, Play, Check, Info } from "lucide-react";

interface ExerciseItem {
  id: string;
  n: string; // name
  bp: string; // body part
  eq: string; // equipment
  tg: string; // target muscle
  mg?: string; // major muscle group
  sm?: string[]; // secondary muscles
  st?: string[]; // steps
  img?: string;
  gif?: string;
}

interface ExerciseLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "picker" | "explorer";
  onSelectExercise?: (exercise: {
    name: string;
    sets: number;
    reps: string;
    targetDay?: string;
  }) => void;
  targetDay?: string;
}

const IMG_BASE =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/";
const GIF_BASE =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/";

export default function ExerciseLibraryModal({
  isOpen,
  onClose,
  mode = "explorer",
  onSelectExercise,
  targetDay = "monday",
}: ExerciseLibraryModalProps) {
  const [search, setSearch] = useState("");
  const [selectedBodyPart, setSelectedBodyPart] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState("all");
  const [activeExercise, setActiveExercise] = useState<ExerciseItem | null>(null);

  // Picker config state
  const [setsCount, setSetsCount] = useState(3);
  const [repsValue, setRepsValue] = useState("10-12");
  const [dayToAssign, setDayToAssign] = useState(targetDay);

  const exercises = exercisesData as ExerciseItem[];

  // Body parts list
  const bodyParts = useMemo(() => {
    const set = new Set(exercises.map((e) => e.bp).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [exercises]);

  // Equipment list
  const equipmentList = useMemo(() => {
    const set = new Set(exercises.map((e) => e.eq).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [exercises]);

  // Filtered exercises with search
  const filtered = useMemo(() => {
    let result = exercises;
    if (selectedBodyPart !== "all") {
      result = result.filter((e) => e.bp.toLowerCase() === selectedBodyPart.toLowerCase());
    }
    if (selectedEquipment !== "all") {
      result = result.filter((e) => e.eq.toLowerCase() === selectedEquipment.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.n.toLowerCase().includes(q) ||
          e.tg.toLowerCase().includes(q) ||
          e.eq.toLowerCase().includes(q)
      );
    }
    return result.slice(0, 80); // top 80 for instant rendering
  }, [exercises, selectedBodyPart, selectedEquipment, search]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!activeExercise || !onSelectExercise) return;
    onSelectExercise({
      name: activeExercise.n.toUpperCase(),
      sets: setsCount,
      reps: repsValue,
      targetDay: dayToAssign,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-5xl h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {mode === "picker" ? "Exercise Library & Routine Picker" : "1,300+ Exercise Form Guide"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "picker"
                  ? "Select from 1,324 exercises and assign prescribed sets & reps."
                  : "Explore proper form, target muscles, and demonstration animations."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border/60 bg-card/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search exercise (e.g. bench press, squat, pull up)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/40 border border-border/70 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:border-brand-gold/60 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBodyPart}
              onChange={(e) => setSelectedBodyPart(e.target.value)}
              className="bg-muted/40 border border-border/70 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-brand-gold/60 outline-none capitalize"
            >
              <option value="all">All Muscles</option>
              {bodyParts.filter((b) => b !== "all").map((bp) => (
                <option key={bp} value={bp}>
                  {bp}
                </option>
              ))}
            </select>

            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="bg-muted/40 border border-border/70 rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-brand-gold/60 outline-none capitalize"
            >
              <option value="all">All Equipment</option>
              {equipmentList.filter((e) => e !== "all").map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Exercise List */}
          <div className="md:col-span-6 border-r border-border/60 overflow-y-auto divide-y divide-border/30 p-2">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No exercises found matching your criteria.
              </div>
            ) : (
              filtered.map((item) => {
                const isActive = activeExercise?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveExercise(item)}
                    className={`p-3 rounded-xl cursor-pointer flex items-center gap-3.5 transition-all ${
                      isActive
                        ? "bg-brand-gold/15 border border-brand-gold/40 shadow-sm"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-black/40 overflow-hidden flex-shrink-0 border border-border/40 flex items-center justify-center">
                      {item.img ? (
                        <img
                          src={`${IMG_BASE}${item.img}`}
                          alt={item.n}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Dumbbell className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm capitalize text-foreground truncate">
                        {item.n}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold font-medium capitalize">
                          {item.tg}
                        </span>
                        <span className="text-[10px] text-muted-foreground capitalize truncate">
                          {item.eq}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? "text-brand-gold translate-x-1" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Details & Assignment Panel */}
          <div className="md:col-span-6 flex flex-col h-full overflow-y-auto p-6 bg-muted/10">
            {activeExercise ? (
              <div className="space-y-6">
                {/* Media Preview: GIF animation */}
                <div className="rounded-2xl overflow-hidden bg-black/50 border border-border aspect-video relative flex items-center justify-center shadow-lg">
                  {activeExercise.gif ? (
                    <img
                      src={`${GIF_BASE}${activeExercise.gif}`}
                      alt={activeExercise.n}
                      className="w-full h-full object-contain"
                    />
                  ) : activeExercise.img ? (
                    <img
                      src={`${IMG_BASE}${activeExercise.img}`}
                      alt={activeExercise.n}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Dumbbell className="w-12 h-12 text-muted-foreground" />
                  )}
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] text-brand-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Play className="w-3 h-3 fill-brand-gold" /> Demo
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold capitalize text-foreground">
                    {activeExercise.n}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-brand-gold/15 text-brand-gold font-semibold capitalize border border-brand-gold/30">
                      Target: {activeExercise.tg}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium capitalize border border-border">
                      Equipment: {activeExercise.eq}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium capitalize border border-border">
                      Body Part: {activeExercise.bp}
                    </span>
                  </div>
                </div>

                {/* Instructions Steps */}
                {activeExercise.st && activeExercise.st.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Step-by-Step Execution
                    </h4>
                    <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside leading-relaxed bg-card/60 p-4 rounded-xl border border-border">
                      {activeExercise.st.map((step, idx) => (
                        <li key={idx} className="pl-1">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Admin Mode: Prescription Controls */}
                {mode === "picker" && (
                  <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 space-y-4">
                    <h4 className="text-sm font-bold text-foreground">
                      Prescribe for Member
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground font-medium">
                          Target Day
                        </label>
                        <select
                          value={dayToAssign}
                          onChange={(e) => setDayToAssign(e.target.value)}
                          className="w-full bg-card border border-border rounded-xl px-2.5 py-2 text-xs text-foreground mt-1 capitalize outline-none"
                        >
                          {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
                            (d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground font-medium">Sets</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={setsCount}
                          onChange={(e) => setSetsCount(Number(e.target.value))}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground mt-1 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground font-medium">Reps / Time</label>
                        <input
                          type="text"
                          value={repsValue}
                          onChange={(e) => setRepsValue(e.target.value)}
                          placeholder="e.g. 10-12 or 45s"
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground mt-1 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAdd}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 text-primary-foreground font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      <Check className="w-4 h-4" /> Add to {dayToAssign.toUpperCase()} Routine
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground space-y-3">
                <Dumbbell className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                <h4 className="font-semibold text-foreground">Select an exercise</h4>
                <p className="text-xs max-w-xs">
                  Choose any exercise from the list to view animated demos, muscle targets, and instructions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
