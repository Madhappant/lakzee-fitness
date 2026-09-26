"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyWorkoutRoutine } from "@/lib/api/portal";
import {
  Loader2,
  Dumbbell,
  Calendar,
  Star,
  Play,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Calculator,
  Flame,
  Award,
} from "lucide-react";
import BodyMap from "@/components/BodyMap";
import RestTimer from "@/components/RestTimer";
import ExerciseLibraryModal from "@/components/ExerciseLibraryModal";
import GymToolsModal from "@/components/GymToolsModal";
import { detectMusclesFromText } from "@/data/muscles";
import { toast } from "sonner";

interface ActiveSetRow {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
}

interface ActiveExerciseProgress {
  name: string;
  sets: ActiveSetRow[];
}

export default function MemberWorkoutPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["myWorkoutRoutine"],
    queryFn: fetchMyWorkoutRoutine,
  });

  // Today's day name in lowercase (e.g. "monday")
  const todayName = useMemo(() => {
    const daysArr = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return daysArr[new Date().getDay()];
  }, []);

  const [selectedDay, setSelectedDay] = useState<string>(todayName);
  const [isLiveWorkoutRunning, setIsLiveWorkoutRunning] = useState<boolean>(false);
  const [liveExercises, setLiveExercises] = useState<ActiveExerciseProgress[]>([]);

  // Rest Timer State
  const [isRestTimerOpen, setIsRestTimerOpen] = useState(false);
  const [currentRestExercise, setCurrentRestExercise] = useState("");

  // Modals
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const routine = data?.data;

  // Parse routine exercisesData
  const exercisesData = useMemo(() => {
    if (!routine?.exercisesData) return {};
    try {
      return JSON.parse(routine.exercisesData);
    } catch {
      return {};
    }
  }, [routine]);

  // Muscles detected for the currently selected day
  const currentDayMuscles = useMemo(() => {
    const dayText = exercisesData[selectedDay] || "";
    return detectMusclesFromText(dayText);
  }, [exercisesData, selectedDay]);

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // Start Live Workout session for selected day
  const startLiveWorkout = () => {
    const content = exercisesData[selectedDay] || "";
    const lines = content
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && !l.toLowerCase().includes("rest"));

    if (lines.length === 0) {
      toast.info("This day is designated as a Rest Day in your routine!");
      return;
    }

    const parsedExercises: ActiveExerciseProgress[] = lines.map((line: string) => {
      // Strip bullets
      const cleaned = line.replace(/^[•\-\*]\s*/, "");
      return {
        name: cleaned,
        sets: [
          { setNumber: 1, weight: 20, reps: 10, completed: false },
          { setNumber: 2, weight: 20, reps: 10, completed: false },
          { setNumber: 3, weight: 20, reps: 10, completed: false },
        ],
      };
    });

    setLiveExercises(parsedExercises);
    setIsLiveWorkoutRunning(true);
    toast.success(`Started ${selectedDay.toUpperCase()} Workout Session! Let's crush it!`);
  };

  const toggleSetComplete = (exIndex: number, setIndex: number) => {
    setLiveExercises((prev) => {
      const copy = [...prev];
      const targetEx = copy[exIndex];
      const targetSet = targetEx.sets[setIndex];
      const nextStatus = !targetSet.completed;
      targetSet.completed = nextStatus;

      if (nextStatus) {
        // Trigger Rest Timer
        setCurrentRestExercise(targetEx.name);
        setIsRestTimerOpen(true);
      }
      return copy;
    });
  };

  const updateSetField = (
    exIndex: number,
    setIndex: number,
    field: "weight" | "reps",
    value: number
  ) => {
    setLiveExercises((prev) => {
      const copy = [...prev];
      copy[exIndex].sets[setIndex][field] = value;
      return copy;
    });
  };

  const addSetToExercise = (exIndex: number) => {
    setLiveExercises((prev) => {
      const copy = [...prev];
      const currentSets = copy[exIndex].sets;
      const lastSet = currentSets[currentSets.length - 1] || { weight: 20, reps: 10 };
      currentSets.push({
        setNumber: currentSets.length + 1,
        weight: lastSet.weight,
        reps: lastSet.reps,
        completed: false,
      });
      return copy;
    });
  };

  // Complete workout calculation
  const totalVolume = useMemo(() => {
    return liveExercises.reduce((acc, ex) => {
      return (
        acc +
        ex.sets.reduce((sAcc, s) => {
          return s.completed ? sAcc + s.weight * s.reps : sAcc;
        }, 0)
      );
    }, 0);
  }, [liveExercises]);

  const completedSetsCount = useMemo(() => {
    return liveExercises.reduce((acc, ex) => {
      return acc + ex.sets.filter((s) => s.completed).length;
    }, 0);
  }, [liveExercises]);

  const totalSetsCount = useMemo(() => {
    return liveExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  }, [liveExercises]);

  const finishWorkout = () => {
    setIsLiveWorkoutRunning(false);
    toast.success(
      `Workout Completed! Total volume lifted: ${totalVolume.toLocaleString()} kg across ${completedSetsCount} sets!`,
      { duration: 5000 }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (isError || !routine) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <h1 className="text-3xl font-bold mb-2">My Workout Routine</h1>
        <div className="glass-panel p-12 text-center border-t-4 border-brand-gold rounded-3xl">
          <Dumbbell className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Active Workout Routine</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You do not have an active workout routine assigned. Your trainer or admin will prescribe a personalized routine for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Floating Rest Timer */}
      <RestTimer
        isOpen={isRestTimerOpen}
        onClose={() => setIsRestTimerOpen(false)}
        exerciseName={currentRestExercise}
        initialSeconds={60}
      />

      {/* Exercise Library Form Guide Modal */}
      <ExerciseLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        mode="explorer"
      />

      {/* Gym Tools (Plate & 1RM Calculator) Modal */}
      <GymToolsModal isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">
              {routine.title || "My Workout Routine"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/30 font-semibold">
              Admin Prescribed
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Your personalized workout splits. Only your admin/trainer can modify your prescribed routine.
          </p>
        </div>

        {/* Quick Tools Launchers */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsLibraryOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-brand-gold" /> Form Guide
          </button>
          <button
            onClick={() => setIsToolsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Calculator className="w-4 h-4 text-brand-gold" /> Plate & 1RM Math
          </button>
          <div className="flex items-center gap-1.5 text-xs text-brand-gold bg-brand-gold/10 px-3.5 py-2 rounded-xl border border-brand-gold/20 font-medium">
            <Calendar className="w-3.5 h-3.5" />
            Issued: {new Date(routine.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Trainer Notes */}
      {routine.notes && (
        <div className="glass-panel p-5 sm:p-6 bg-gradient-to-r from-brand-gold/15 to-transparent border-l-4 border-l-brand-gold rounded-2xl">
          <h3 className="text-sm font-bold text-brand-gold flex items-center gap-1.5 mb-1.5">
            <Award className="w-4 h-4" /> Trainer Prescription Notes
          </h3>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap leading-relaxed">
            {routine.notes}
          </p>
        </div>
      )}

      {/* Days Selection Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {days.map((day) => {
          const isSelected = selectedDay === day;
          const isToday = todayName === day;
          const hasContent = Boolean(exercisesData[day]?.trim());

          return (
            <button
              key={day}
              onClick={() => {
                setSelectedDay(day);
                if (isLiveWorkoutRunning) setIsLiveWorkoutRunning(false);
              }}
              className={`px-4 py-3 rounded-2xl border text-left transition-all flex-shrink-0 min-w-[130px] ${
                isSelected
                  ? "bg-brand-gold text-white border-brand-gold shadow-lg shadow-brand-gold/20 scale-[1.02]"
                  : "bg-card/60 hover:bg-card border-border/70 text-foreground"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold capitalize">
                <span>{day.slice(0, 3)}</span>
                {isToday && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                      isSelected ? "bg-black/30 text-white" : "bg-brand-gold/20 text-brand-gold"
                    }`}
                  >
                    Today
                  </span>
                )}
              </div>
              <div className="text-sm font-bold capitalize mt-1 truncate">
                {day}
              </div>
              <div
                className={`text-[11px] mt-0.5 truncate ${
                  isSelected ? "text-white/80" : "text-muted-foreground"
                }`}
              >
                {hasContent ? "Workout Assigned" : "Rest Day"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Workout Plan vs Anatomy BodyMap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Routine & Live Workout Runner (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Day Header Card */}
          <div className="glass-panel p-6 rounded-3xl border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-brand-gold">
                <Star className="w-4 h-4 fill-brand-gold" />
                <span>{selectedDay} Schedule</span>
              </div>
              <h2 className="text-2xl font-black text-foreground capitalize mt-1">
                {exercisesData[selectedDay]?.split("\n")[0] || "Rest & Recovery"}
              </h2>
            </div>

            {!isLiveWorkoutRunning ? (
              <button
                onClick={startLiveWorkout}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 text-white font-bold text-sm shadow-xl shadow-brand-gold/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" /> Start Workout
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={finishWorkout}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Finish & Log
                </button>
                <button
                  onClick={() => setIsLiveWorkoutRunning(false)}
                  className="p-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground transition-all"
                  title="Reset Workout Session"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* If Live Workout is active */}
          {isLiveWorkoutRunning ? (
            <div className="space-y-6">
              {/* Live Session Status Tracker */}
              <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Sets Completed</div>
                  <div className="text-2xl font-black text-brand-gold">
                    {completedSetsCount} / {totalSetsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Total Volume</div>
                  <div className="text-2xl font-black text-foreground">
                    {totalVolume.toLocaleString()} <span className="text-xs font-normal">kg</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">Rest Timer</div>
                  <button
                    onClick={() => setIsRestTimerOpen(true)}
                    className="mt-1 text-xs font-bold text-brand-gold underline"
                  >
                    Open Timer
                  </button>
                </div>
              </div>

              {/* Active Exercise Cards */}
              <div className="space-y-4">
                {liveExercises.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    className="glass-panel p-5 rounded-2xl border border-border/80 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-brand-gold/20 text-brand-gold text-xs font-black flex items-center justify-center">
                          {exIdx + 1}
                        </span>
                        <h4 className="font-bold text-foreground text-base capitalize">
                          {ex.name}
                        </h4>
                      </div>
                      <button
                        onClick={() => addSetToExercise(exIdx)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      >
                        + Add Set
                      </button>
                    </div>

                    {/* Sets table */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2">
                        <div className="col-span-2">Set</div>
                        <div className="col-span-4">Weight (kg)</div>
                        <div className="col-span-3">Reps</div>
                        <div className="col-span-3 text-right">Done</div>
                      </div>

                      {ex.sets.map((set, setIdx) => (
                        <div
                          key={setIdx}
                          className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition-all ${
                            set.completed
                              ? "bg-emerald-500/10 border border-emerald-500/30"
                              : "bg-muted/20 border border-border/40"
                          }`}
                        >
                          <div className="col-span-2 text-xs font-bold text-muted-foreground">
                            Set {set.setNumber}
                          </div>
                          <div className="col-span-4">
                            <input
                              type="number"
                              step="2.5"
                              value={set.weight}
                              onChange={(e) =>
                                updateSetField(exIdx, setIdx, "weight", Number(e.target.value))
                              }
                              className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-sm font-semibold text-foreground outline-none"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) =>
                                updateSetField(exIdx, setIdx, "reps", Number(e.target.value))
                              }
                              className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-sm font-semibold text-foreground outline-none"
                            />
                          </div>
                          <div className="col-span-3 flex justify-end">
                            <button
                              onClick={() => toggleSetComplete(exIdx, setIdx)}
                              className={`p-1.5 rounded-lg transition-all ${
                                set.completed
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-muted text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Prescribed Workout Display View */
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-border/80 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Prescribed Exercises for {selectedDay}
              </h3>

              {exercisesData[selectedDay]?.trim() ? (
                <div className="space-y-3">
                  {exercisesData[selectedDay]
                    .split("\n")
                    .filter((l: string) => l.trim().length > 0)
                    .map((line: string, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/40 hover:border-brand-gold/40 transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground leading-relaxed">
                          {line}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Flame className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="font-semibold text-foreground text-sm">Scheduled Rest Day</p>
                  <p className="text-xs">Take time to stretch, hydrate, and allow your muscles to recover.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Anatomical Body Map (4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm text-foreground">Targeted Anatomy</h3>
              <span className="text-xs text-brand-gold font-semibold capitalize">
                {selectedDay} Muscles
              </span>
            </div>
            <BodyMap highlightedMuscles={currentDayMuscles} />
          </div>

          {/* Form Guide Banner */}
          <div className="p-5 rounded-2xl glass-panel border border-border/80 bg-gradient-to-br from-brand-gold/10 to-transparent space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-gold/20 text-brand-gold flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground">Form & Technique</h4>
                <p className="text-xs text-muted-foreground">Animated exercise guide</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Unsure about proper execution? Search our library of 1,324 exercises with demo animations and step-by-step cues.
            </p>
            <button
              onClick={() => setIsLibraryOpen(true)}
              className="w-full py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-bold transition-all"
            >
              Browse Exercise Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
