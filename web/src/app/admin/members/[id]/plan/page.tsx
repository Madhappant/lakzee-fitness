"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMemberById, assignDietPlan, assignWorkoutRoutine } from "@/lib/api/members";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Dumbbell, Utensils } from "lucide-react";

export default function AssignPlanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"DIET" | "WORKOUT">("DIET");

  const [dietForm, setDietForm] = useState({
    title: "Personalized Diet Plan",
    notes: "",
    mealsData: {
      breakfast: "",
      lunch: "",
      dinner: "",
      snacks: ""
    }
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
      sunday: ""
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => fetchMemberById(id),
    enabled: !!id,
  });

  const dietMutation = useMutation({
    mutationFn: (data: any) => assignDietPlan(id, data),
    onSuccess: () => {
      alert("Diet Plan assigned successfully!");
      router.push(`/admin/members`);
    },
    onError: (err: any) => alert(err.message)
  });

  const workoutMutation = useMutation({
    mutationFn: (data: any) => assignWorkoutRoutine(id, data),
    onSuccess: () => {
      alert("Workout Routine assigned successfully!");
      router.push(`/admin/members`);
    },
    onError: (err: any) => alert(err.message)
  });

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
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/members" className="p-2 rounded-xl glass-panel hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-brand-gold" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Assign Plans</h1>
          <p className="text-muted-foreground">For {member.firstName} {member.lastName} ({member.memberProfile?.memberId})</p>
        </div>
      </div>

      <div className="flex bg-card/50 p-1 rounded-xl glass-panel">
        <button
          onClick={() => setActiveTab("DIET")}
          className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "DIET" ? "bg-white/10 text-brand-gold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Utensils className="w-4 h-4" /> Diet Plan
        </button>
        <button
          onClick={() => setActiveTab("WORKOUT")}
          className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTab === "WORKOUT" ? "bg-white/10 text-brand-gold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Dumbbell className="w-4 h-4" /> Workout Routine
        </button>
      </div>

      {activeTab === "DIET" ? (
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold text-brand-gold mb-4">Diet Prescriptions</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Plan Title</label>
              <input 
                type="text"
                value={dietForm.title}
                onChange={(e) => setDietForm({...dietForm, title: e.target.value})}
                className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">General Guidelines (Optional)</label>
              <textarea 
                value={dietForm.notes}
                onChange={(e) => setDietForm({...dietForm, notes: e.target.value})}
                className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1 resize-none h-24" 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['breakfast', 'lunch', 'dinner', 'snacks'].map((meal) => (
                <div key={meal}>
                  <label className="text-sm font-medium text-muted-foreground capitalize">{meal}</label>
                  <textarea 
                    value={(dietForm.mealsData as any)[meal]}
                    onChange={(e) => setDietForm({
                      ...dietForm, 
                      mealsData: { ...dietForm.mealsData, [meal]: e.target.value }
                    })}
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1 resize-none h-24" 
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={() => dietMutation.mutate(dietForm)}
                disabled={dietMutation.isPending}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 font-bold"
              >
                {dietMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Assign Diet Plan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-semibold text-brand-gold mb-4">Workout Prescriptions</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Routine Title</label>
              <input 
                type="text"
                value={workoutForm.title}
                onChange={(e) => setWorkoutForm({...workoutForm, title: e.target.value})}
                className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Trainer Notes (Optional)</label>
              <textarea 
                value={workoutForm.notes}
                onChange={(e) => setWorkoutForm({...workoutForm, notes: e.target.value})}
                className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1 resize-none h-24" 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <div key={day}>
                  <label className="text-sm font-medium text-muted-foreground capitalize">{day}</label>
                  <textarea 
                    value={(workoutForm.exercisesData as any)[day]}
                    onChange={(e) => setWorkoutForm({
                      ...workoutForm, 
                      exercisesData: { ...workoutForm.exercisesData, [day]: e.target.value }
                    })}
                    placeholder="e.g. Chest & Triceps: Bench Press 3x10..."
                    className="w-full bg-card/50 border border-border rounded-xl px-4 py-3 text-foreground focus:border-brand-gold/50 outline-none mt-1 resize-none h-24" 
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={() => workoutMutation.mutate(workoutForm)}
                disabled={workoutMutation.isPending}
                className="flex items-center gap-2 px-8 py-3 rounded-xl text-primary-foreground bg-gradient-to-r from-brand-gold to-yellow-500 hover:from-yellow-400 font-bold"
              >
                {workoutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Assign Workout Routine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
