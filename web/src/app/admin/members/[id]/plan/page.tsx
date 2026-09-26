/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMemberById, assignDietPlan, assignWorkoutRoutine } from "@/lib/api/members";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Dumbbell,
  Utensils,
  BookOpen,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import BodyMap from "@/components/BodyMap";
import ExerciseLibraryModal from "@/components/ExerciseLibraryModal";
import { detectMusclesFromText } from "@/data/muscles";

export default function AssignPlanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"DIET" | "WORKOUT">("DIET");

  // Exercise Library Modal State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [pickerTargetDay, setPickerTargetDay] = useState("monday");

  const [dietForm, setDietForm] = useState({
    title: "Personalized Diet Plan",
    notes: "",
    mealsData: {
      breakfast: "",
      lunch: "",
      dinner: "",
      snacks: "",
    },
  });

  const [workoutForm, setWorkoutForm] = useState({
    title: "Personalized Workout Routine",
    notes: "",
    exercisesData: {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => fetchMemberById(id),
    enabled: !!id,
  });

  const dietMutation = useMutation({
    mutationFn: (data: any) => assignDietPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      alert("Diet Plan assigned successfully!");
      router.push(`/admin/members`);
    },
    onError: (err: any) => alert(err.message),
  });

  const workoutMutation = useMutation({
    mutationFn: (data: any) => assignWorkoutRoutine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      alert("Workout Routine assigned successfully!");
      router.push(`/admin/members`);
    },
    onError: (err: any) => alert(err.message),
  });

  // Calculate targeted muscles across the whole weekly plan
  const detectedMuscles = useMemo(() => {
    const allText = Object.values(workoutForm.exercisesData).join(" \n ");
    return detectMusclesFromText(allText);
  }, [workoutForm.exercisesData]);

  // Handle inserting an exercise selected from library modal
  const handleAddExerciseFromLibrary = (ex: {
    name: string;
    sets: number;
    reps: string;
    targetDay?: string;
  }) => {
    const day = (ex.targetDay || pickerTargetDay).toLowerCase();
    const current = (workoutForm.exercisesData as any)[day] || "";
    const newEntry = `• ${ex.name} - ${ex.sets} sets × ${ex.reps}`;
    const updated = current.trim() ? `${current.trim()}\n${newEntry}` : newEntry;

    setWorkoutForm({
      ...workoutForm,
      exercisesData: {
        ...workoutForm.exercisesData,
        [day]: updated,
      },
    });
  };

  // Preset Workout Splits
  const applyWorkoutPreset = (type: "PPL" | "UPPER_LOWER" | "FULL_BODY" | "STRENGTH") => {
    if (type === "PPL") {
      setWorkoutForm({
        ...workoutForm,
        title: "Push, Pull, Legs Hypertrophy Split",
        notes: "Target 8-12 reps per set with 90 seconds rest. Focus on progressive overload.",
        exercisesData: {
          monday: "Chest & Shoulders & Triceps (Push):\n• Barbell Bench Press - 4 sets × 8-10 reps\n• Incline Dumbbell Press - 3 sets × 10-12 reps\n• Dumbbell Lateral Raise - 4 sets × 12-15 reps\n• Cable Tricep Pushdown - 3 sets × 12 reps",
          tuesday: "Back & Biceps (Pull):\n• Lat Pulldown / Pull-ups - 4 sets × 8-10 reps\n• Seated Cable Row - 3 sets × 10-12 reps\n• Face Pulls - 3 sets × 15 reps\n• Barbell Bicep Curl - 3 sets × 10 reps",
          wednesday: "Legs & Core:\n• Barbell Back Squat - 4 sets × 8-10 reps\n• Romanian Deadlift - 3 sets × 10 reps\n• Leg Press - 3 sets × 12 reps\n• Hanging Leg Raise - 3 sets × 15 reps",
          thursday: "Rest & Active Recovery / Light Cardio 30 mins",
          friday: "Push (Chest & Delts Focus):\n• Incline Barbell Press - 4 sets × 8-10 reps\n• Dumbbell Overhead Shoulder Press - 3 sets × 10 reps\n• Cable Chest Fly - 3 sets × 12 reps\n• Skull Crushers - 3 sets × 10 reps",
          saturday: "Pull & Legs Hybrid:\n• Barbell Bent Over Row - 4 sets × 8-10 reps\n• Dumbbell Walking Lunges - 3 sets × 12 reps\n• Hammer Curls - 3 sets × 12 reps\n• Plank - 3 sets × 60s",
          sunday: "Full Rest & Recovery Day",
        },
      });
    } else if (type === "UPPER_LOWER") {
      setWorkoutForm({
        ...workoutForm,
        title: "4-Day Upper / Lower Split",
        notes: "Ideal for balanced muscle hypertrophy and strength.",
        exercisesData: {
          monday: "Upper Body Power:\n• Barbell Bench Press - 4 sets × 6-8 reps\n• Barbell Row - 4 sets × 6-8 reps\n• Overhead Dumbbell Press - 3 sets × 8-10 reps\n• Barbell Bicep Curl - 3 sets × 10 reps",
          tuesday: "Lower Body Power:\n• Barbell Squat - 4 sets × 6-8 reps\n• Romanian Deadlift - 3 sets × 8 reps\n• Standing Calf Raise - 4 sets × 12 reps\n• Cable Woodchoppers - 3 sets × 15 reps",
          wednesday: "Rest & Mobility Day",
          thursday: "Upper Body Hypertrophy:\n• Incline Dumbbell Press - 3 sets × 10-12 reps\n• Lat Pulldown - 3 sets × 10-12 reps\n• Lateral Raise - 4 sets × 15 reps\n• Tricep Dips - 3 sets × 12 reps",
          friday: "Lower Body Hypertrophy:\n• Leg Press - 4 sets × 10-12 reps\n• Hamstring Leg Curl - 3 sets × 12 reps\n• Bulgarian Split Squats - 3 sets × 10 reps\n• Ab Wheel Rollout - 3 sets × 12 reps",
          saturday: "Light Cardio / Abs / Rest",
          sunday: "Full Rest & Recovery",
        },
      });
    } else if (type === "FULL_BODY") {
      setWorkoutForm({
        ...workoutForm,
        title: "3-Day Full Body Conditioning",
        notes: "Compound movements across the whole body for functional fitness and fat loss.",
        exercisesData: {
          monday: "Full Body A:\n• Barbell Squat - 3 sets × 10 reps\n• Barbell Bench Press - 3 sets × 10 reps\n• Bent Over Row - 3 sets × 10 reps\n• Plank - 3 sets × 45s",
          tuesday: "Rest Day",
          wednesday: "Full Body B:\n• Conventional Deadlift - 3 sets × 8 reps\n• Dumbbell Overhead Press - 3 sets × 10 reps\n• Lat Pulldown - 3 sets × 10 reps\n• Bicep & Tricep Superset - 3 sets × 12 reps",
          thursday: "Rest Day",
          friday: "Full Body C:\n• Leg Press - 3 sets × 12 reps\n• Incline Dumbbell Bench Press - 3 sets × 10 reps\n• Seated Cable Row - 3 sets × 10 reps\n• Hanging Knee Raise - 3 sets × 15 reps",
          saturday: "Cardio 30 mins (Treadmill / Cycling)",
          sunday: "Rest Day",
        },
      });
    }
  };

  // Preset Diet Templates
  const applyDietPreset = (type: "FAT_LOSS" | "MUSCLE_GAIN" | "BALANCED") => {
    if (type === "FAT_LOSS") {
      setDietForm({
        ...dietForm,
        title: "Calorie Deficit & Lean Muscle Preservation",
        notes: "Drink 3.5L of water daily. Avoid sugary drinks and deep-fried foods.",
        mealsData: {
          breakfast: "3 boiled eggs (1 whole + 2 whites) + 1 cup oatmeal with berries + Green tea without sugar",
          lunch: "150g grilled chicken breast or 150g tofu/paneer + 1 cup brown rice + Large bowl of mixed green salad",
          dinner: "150g grilled fish/soya chunks + Stir-fried broccoli, zucchini, bell peppers + Clear vegetable soup",
          snacks: "1 scoop Whey Protein in water + 15 raw almonds + 1 green apple",
        },
      });
    } else if (type === "MUSCLE_GAIN") {
      setDietForm({
        ...dietForm,
        title: "Clean Hypertrophy & Bulking Plan",
        notes: "Caloric surplus with high quality protein and complex carbohydrates.",
        mealsData: {
          breakfast: "4 eggs (2 whole + 2 whites) + 2 whole wheat toasts with peanut butter + 1 banana + Glass of milk",
          lunch: "200g chicken breast or 200g paneer + 1.5 cups basmati rice + Dal/lentils + Mixed veggies with olive oil",
          dinner: "200g lean fish / chicken / tofu + 2 chapattis + Curd / Greek yogurt + Steamed vegetables",
          snacks: "1 protein shake with oats and peanut butter + Handful of walnuts and raisins",
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const member = data?.data;
  if (!member) return <div className="text-muted-foreground">Member not found.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Exercise Picker Modal */}
      <ExerciseLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        mode="picker"
        targetDay={pickerTargetDay}
        onSelectExercise={handleAddExerciseFromLibrary}
      />

      <div className="flex items-center gap-4">
        <Link
          href="/admin/members"
          className="p-2.5 rounded-xl glass-panel hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-brand-gold" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Assign Plans</h1>
          <p className="text-muted-foreground">
            For {member.firstName} {member.lastName} ({member.memberProfile?.memberId})
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-card/60 p-1.5 rounded-2xl glass-panel border border-border/60">
        <button
          onClick={() => setActiveTab("DIET")}
          className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "DIET"
              ? "bg-brand-gold text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Utensils className="w-4 h-4" /> Diet Plan
        </button>
        <button
          onClick={() => setActiveTab("WORKOUT")}
          className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
            activeTab === "WORKOUT"
              ? "bg-brand-gold text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Dumbbell className="w-4 h-4" /> Workout Routine
        </button>
      </div>

      {activeTab === "DIET" ? (
        <div className="glass-panel p-6 sm:p-8 space-y-6 rounded-2xl border border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-xl font-bold text-brand-gold">Diet Prescriptions</h2>
              <p className="text-xs text-muted-foreground">Admin/Trainer assigned meal guide for this member.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">Quick Presets:</span>
              <button
                type="button"
                onClick={() => applyDietPreset("FAT_LOSS")}
                className="px-2.5 py-1 text-xs rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3 h-3 text-brand-gold" /> Fat Loss
              </button>
              <button
                type="button"
                onClick={() => applyDietPreset("MUSCLE_GAIN")}
                className="px-2.5 py-1 text-xs rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3 h-3 text-brand-gold" /> Muscle Gain
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Plan Title</label>
              <input
                type="text"
                value={dietForm.title}
                onChange={(e) => setDietForm({ ...dietForm, title: e.target.value })}
                className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/60 outline-none mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                General Guidelines (Optional)
              </label>
              <textarea
                value={dietForm.notes}
                onChange={(e) => setDietForm({ ...dietForm, notes: e.target.value })}
                className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/60 outline-none mt-1 resize-none h-24"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["breakfast", "lunch", "dinner", "snacks"].map((meal) => (
                <div key={meal}>
                  <label className="text-xs font-semibold text-muted-foreground capitalize">
                    {meal}
                  </label>
                  <textarea
                    value={(dietForm.mealsData as any)[meal]}
                    onChange={(e) =>
                      setDietForm({
                        ...dietForm,
                        mealsData: { ...dietForm.mealsData, [meal]: e.target.value },
                      })
                    }
                    className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/60 outline-none mt-1 resize-none h-28"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-border/40">
              <button
                onClick={() => dietMutation.mutate(dietForm)}
                disabled={dietMutation.isPending}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-white bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 font-bold shadow-lg transition-all"
              >
                {dietMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Assign Diet Plan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Routine Form (8 columns) */}
          <div className="lg:col-span-8 glass-panel p-6 sm:p-8 space-y-6 rounded-2xl border border-border/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
              <div>
                <h2 className="text-xl font-bold text-brand-gold">Workout Prescriptions</h2>
                <p className="text-xs text-muted-foreground">Admin/Trainer assigned exercises and weekly splits.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyWorkoutPreset("PPL")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-brand-gold" /> Push Pull Legs
                </button>
                <button
                  type="button"
                  onClick={() => applyWorkoutPreset("UPPER_LOWER")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-brand-gold" /> Upper Lower
                </button>
                <button
                  type="button"
                  onClick={() => applyWorkoutPreset("FULL_BODY")}
                  className="px-2.5 py-1 text-xs rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-brand-gold" /> Full Body
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Routine Title</label>
                <input
                  type="text"
                  value={workoutForm.title}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, title: e.target.value })}
                  className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/60 outline-none mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Trainer Notes (Optional)
                </label>
                <textarea
                  value={workoutForm.notes}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, notes: e.target.value })}
                  className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/60 outline-none mt-1 resize-none h-20"
                />
              </div>

              {/* Monday to Sunday Daily Editors */}
              <div className="space-y-4">
                {[
                  "monday",
                  "tuesday",
                  "wednesday",
                  "thursday",
                  "friday",
                  "saturday",
                  "sunday",
                ].map((day) => (
                  <div key={day} className="p-4 rounded-xl bg-muted/15 border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-foreground capitalize flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-gold" />
                        {day}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPickerTargetDay(day);
                          setIsLibraryOpen(true);
                        }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-gold/15 text-brand-gold hover:bg-brand-gold hover:text-white transition-colors flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add from Library
                      </button>
                    </div>
                    <textarea
                      value={(workoutForm.exercisesData as any)[day]}
                      onChange={(e) =>
                        setWorkoutForm({
                          ...workoutForm,
                          exercisesData: { ...workoutForm.exercisesData, [day]: e.target.value },
                        })
                      }
                      placeholder="e.g. Chest & Triceps: Bench Press 3x10, Incline Dumbbell Press 3x12..."
                      className="w-full bg-card/60 border border-border/80 rounded-xl px-4 py-3 text-sm text-foreground focus:border-brand-gold/60 outline-none resize-none h-24"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-border/40">
                <button
                  onClick={() => workoutMutation.mutate(workoutForm)}
                  disabled={workoutMutation.isPending}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-white bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 font-bold shadow-lg transition-all"
                >
                  {workoutMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Assign Workout Routine
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Anatomical Body Map & Library Quick Launcher (4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Exercise Library Launcher */}
            <div className="p-5 rounded-2xl glass-panel border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 to-transparent space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center text-white shadow-md">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">1,324 Exercises</h4>
                  <p className="text-xs text-muted-foreground">Search and insert exercises</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Browse our complete database of exercises with animated form demonstrations and instructions to assign balanced routines.
              </p>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="w-full py-2.5 rounded-xl bg-brand-gold text-white font-bold text-xs hover:bg-brand-gold/90 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Dumbbell className="w-4 h-4" /> Open Exercise Library
              </button>
            </div>

            {/* Live Body Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-sm font-bold text-foreground">Targeted Anatomy</h4>
                <span className="text-[11px] text-brand-gold font-medium">Live Weekly Preview</span>
              </div>
              <BodyMap highlightedMuscles={detectedMuscles} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
