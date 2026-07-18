"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyWorkoutRoutine } from "@/lib/api/portal";
import { Loader2, Dumbbell, Calendar, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function MemberWorkoutPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["myWorkoutRoutine"],
    queryFn: fetchMyWorkoutRoutine,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const routine = data?.data;

  if (isError || !routine) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <h1 className="text-3xl font-bold mb-2">My Workout Routine</h1>
        <div className="glass-panel p-12 text-center border-t-4 border-brand-gold">
          <Dumbbell className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Active Workout Routine</h2>
          <p className="text-muted-foreground">You do not have an active workout routine assigned. Please speak to your trainer to get a personalized plan.</p>
        </div>
      </div>
    );
  }

  let exercisesData: any = {};
  try {
    exercisesData = JSON.parse(routine.exercisesData);
  } catch (e) {}

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{routine.title || "My Workout Routine"}</h1>
          <p className="text-muted-foreground">Your prescribed exercises and splits.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-brand-gold bg-brand-gold/10 px-4 py-2 rounded-full border border-brand-gold/20">
          <Calendar className="w-4 h-4" />
          Issued on: {new Date(routine.createdAt).toLocaleDateString()}
        </div>
      </div>

      {routine.notes && (
        <div className="glass-panel p-6 sm:p-8 bg-gradient-to-br from-brand-gold/10 to-transparent border-l-4 border-l-brand-gold">
          <h3 className="font-semibold text-brand-gold mb-2">Trainer Notes</h3>
          <p className="text-white/80 whitespace-pre-wrap">{routine.notes}</p>
        </div>
      )}

      <div className="space-y-4">
        {days.map((day, index) => {
          const content = exercisesData[day];
          if (!content) return null;

          // Split by lines for a list effect
          const lines = content.split('\n').filter((l: string) => l.trim() !== '');

          return (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              key={day} 
              className="glass-panel p-6 sm:p-8 flex flex-col md:flex-row gap-6 relative overflow-hidden group"
            >
              <div className="md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-6">
                <h3 className="text-xl font-bold capitalize text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-gold" />
                  {day}
                </h3>
              </div>
              <div className="flex-1 space-y-2">
                {lines.map((line: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-white/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-2 flex-shrink-0" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
