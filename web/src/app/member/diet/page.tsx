"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyDietPlan } from "@/lib/api/portal";
import { Loader2, Utensils, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function MemberDietPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["myDietPlan"],
    queryFn: fetchMyDietPlan,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  const plan = data?.data;

  if (isError || !plan) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <h1 className="text-3xl font-bold mb-2">My Diet Plan</h1>
        <div className="glass-panel p-12 text-center border-t-4 border-brand-gold">
          <Utensils className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Active Diet Plan</h2>
          <p className="text-muted-foreground">You do not have an active diet plan assigned. Please speak to your trainer or the front desk to get a personalized plan.</p>
        </div>
      </div>
    );
  }

  let mealsData: any = {};
  try {
    mealsData = JSON.parse(plan.mealsData);
  } catch (e) {}

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{plan.title || "My Diet Plan"}</h1>
          <p className="text-muted-foreground">Your personalized nutrition guidelines.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-brand-gold bg-brand-gold/10 px-4 py-2 rounded-full border border-brand-gold/20">
          <Calendar className="w-4 h-4" />
          Issued on: {new Date(plan.createdAt).toLocaleDateString()}
        </div>
      </div>

      {plan.notes && (
        <div className="glass-panel p-6 sm:p-8 bg-gradient-to-br from-brand-gold/10 to-transparent border-l-4 border-l-brand-gold">
          <h3 className="font-semibold text-brand-gold mb-2">General Guidelines</h3>
          <p className="text-white/80 whitespace-pre-wrap">{plan.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal, index) => {
          const content = mealsData[meal];
          if (!content) return null;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={meal} 
              className="glass-panel p-6 sm:p-8 relative overflow-hidden group"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gold/5 rounded-full blur-2xl group-hover:bg-brand-gold/10 transition-colors" />
              <h3 className="text-xl font-bold capitalize text-foreground mb-4 flex items-center gap-2 border-b border-border pb-4">
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
                  <Utensils className="w-4 h-4 text-brand-gold" />
                </div>
                {meal}
              </h3>
              <p className="text-white/70 whitespace-pre-wrap leading-relaxed">{content}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
