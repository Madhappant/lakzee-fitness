"use client";

import React, { useMemo } from "react";
import { Flame, Calendar, Trophy } from "lucide-react";

interface ActivityHeatmapProps {
  activityDates?: string[]; // ISO date strings e.g. "2026-09-25"
  weeksCount?: number;
}

export default function ActivityHeatmap({
  activityDates = [],
  weeksCount = 20,
}: ActivityHeatmapProps) {
  // Aggregate count by YYYY-MM-DD
  const activityMap = useMemo(() => {
    const map: Record<string, number> = {};
    activityDates.forEach((d) => {
      const key = d.split("T")[0];
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [activityDates]);

  // Generate grid weeks
  const { weeks, monthLabels, currentStreak, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resultWeeks = [];
    const months = [];
    let lastMonth = -1;

    // Start from weeksCount weeks ago, aligned to Monday
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek - (weeksCount - 1) * 7);

    for (let w = 0; w < weeksCount; w++) {
      const weekDays = [];
      const colStart = new Date(startDate);
      colStart.setDate(startDate.getDate() + w * 7);

      const m = colStart.getMonth();
      if (m !== lastMonth && colStart.getDate() <= 10) {
        months.push({
          weekIdx: w,
          label: colStart.toLocaleString("default", { month: "short" }),
        });
        lastMonth = m;
      }

      for (let d = 0; d < 7; d++) {
        const current = new Date(colStart);
        current.setDate(colStart.getDate() + d);
        const iso = current.toISOString().split("T")[0];
        const isFuture = current > today;
        const count = activityMap[iso] || 0;

        weekDays.push({
          date: iso,
          count,
          isFuture,
          isToday: current.getTime() === today.getTime(),
        });
      }
      resultWeeks.push(weekDays);
    }

    // Calculate current streak
    let streak = 0;
    const checkDate = new Date(today);
    while (true) {
      const iso = checkDate.toISOString().split("T")[0];
      if (activityMap[iso]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow 1 day break for today if not yet checked in
        if (checkDate.getTime() === today.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return {
      weeks: resultWeeks,
      monthLabels: months,
      currentStreak: streak,
      totalDays: Object.keys(activityMap).length,
    };
  }, [activityMap, weeksCount]);

  const getLevelClass = (count: number, isFuture: boolean) => {
    if (isFuture) return "bg-transparent opacity-0 pointer-events-none";
    if (count === 0) return "bg-white/5 dark:bg-white/10 hover:bg-white/20";
    if (count === 1) return "bg-brand-gold/40 border border-brand-gold/50";
    if (count === 2) return "bg-brand-gold/70 border border-brand-gold/80";
    return "bg-brand-gold border border-yellow-300 shadow-[0_0_8px_rgba(217,160,43,0.7)]";
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-border/80 space-y-4">
      {/* Header with Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-gold" /> Workout & Attendance Consistency
          </h3>
          <p className="text-xs text-muted-foreground">Activity logs for the last {weeksCount} weeks</p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-gold/15 text-brand-gold border border-brand-gold/30 font-bold">
            <Flame className="w-4 h-4 fill-brand-gold" />
            <span>{currentStreak} Day Streak</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 text-foreground border border-border font-semibold">
            <Trophy className="w-3.5 h-3.5 text-brand-gold" />
            <span>{totalDays} Active Days</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2 scrollbar-none">
        <div className="min-w-[500px]">
          {/* Month labels */}
          <div className="flex text-[10px] text-muted-foreground font-semibold mb-1 pl-7">
            {weeks.map((_, idx) => {
              const m = monthLabels.find((ml) => ml.weekIdx === idx);
              return (
                <div key={idx} className="w-3.5 mr-1 text-left">
                  {m ? m.label : ""}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            {/* Day of week labels */}
            <div className="flex flex-col justify-between text-[9px] text-muted-foreground font-bold pr-1 pt-0.5 select-none">
              <span>Mon</span>
              <span className="opacity-0">Tue</span>
              <span>Wed</span>
              <span className="opacity-0">Thu</span>
              <span>Fri</span>
              <span className="opacity-0">Sat</span>
              <span>Sun</span>
            </div>

            {/* Grid Columns */}
            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1">
                  {week.map((cell, dIdx) => (
                    <div
                      key={dIdx}
                      className={`w-3.5 h-3.5 rounded-sm transition-all cursor-pointer ${getLevelClass(
                        cell.count,
                        cell.isFuture
                      )} ${cell.isToday ? "ring-2 ring-brand-gold ring-offset-1 ring-offset-background" : ""}`}
                      title={`${cell.date}: ${cell.count > 0 ? `${cell.count} session(s)` : "Rest"}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground mt-3 pr-2">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold/40" />
            <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold/70" />
            <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
