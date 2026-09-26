"use client";

import React, { useState } from "react";
import { BODY_PATHS } from "@/data/body-paths";
import { MUSCLES, INERT, MUSCLE_NAME, MuscleKey } from "@/data/muscles";

interface BodyMapProps {
  highlightedMuscles?: (string | MuscleKey)[];
  selectedMuscle?: string | null;
  onMuscleClick?: (muscle: string) => void;
  gender?: "male" | "female";
  view?: "both" | "front" | "back";
  className?: string;
  showLabels?: boolean;
}

export default function BodyMap({
  highlightedMuscles = [],
  selectedMuscle = null,
  onMuscleClick,
  gender = "male",
  view = "both",
  className = "",
  showLabels = true,
}: BodyMapProps) {
  const [activeGender, setActiveGender] = useState<"male" | "female">(gender);
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);

  const model = BODY_PATHS[activeGender] || BODY_PATHS.male;

  const isHighlighted = (muscle: string) => {
    return highlightedMuscles.some(
      (m) => m.toLowerCase().replace(/[\s_]/g, "-") === muscle.toLowerCase()
    );
  };

  const isSelected = (muscle: string) => {
    return selectedMuscle && selectedMuscle.toLowerCase() === muscle.toLowerCase();
  };

  const renderSvgView = (type: "front" | "back", label: string) => {
    const viewData = model[type];
    if (!viewData) return null;

    return (
      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
          {label}
        </span>
        <svg
          viewBox={viewData.vb}
          className="w-full max-h-[300px] h-auto drop-shadow-md select-none transition-all"
        >
          {/* Inert silhouette body parts (head, hair, hands, feet) */}
          {INERT.map((slug) =>
            (viewData.p[slug] || []).map((d: string, i: number) => (
              <path
                key={`inert-${slug}-${i}`}
                d={d}
                className="fill-white/10 dark:fill-white/15 stroke-black/20 dark:stroke-white/5 transition-colors"
              />
            ))
          )}

          {/* Muscle groups */}
          {MUSCLES.map((slug) =>
            (viewData.p[slug] || []).map((d: string, i: number) => {
              const highlighted = isHighlighted(slug);
              const selected = isSelected(slug);
              const isHovered = hoveredMuscle === slug;

              let fillClass = "fill-white/15 dark:fill-white/20 hover:fill-white/35";
              if (highlighted) {
                fillClass = "fill-brand-gold/80 hover:fill-brand-gold stroke-brand-gold/50";
              }
              if (selected || isHovered) {
                fillClass = "fill-yellow-400 stroke-brand-gold filter brightness-125";
              }

              return (
                <path
                  key={`muscle-${slug}-${i}`}
                  d={d}
                  onClick={onMuscleClick ? () => onMuscleClick(slug) : undefined}
                  onMouseEnter={() => setHoveredMuscle(slug)}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className={`${fillClass} transition-all duration-200 cursor-pointer ${
                    highlighted ? "filter drop-shadow-[0_0_8px_rgba(217,160,43,0.5)]" : ""
                  }`}
                >
                  <title>{MUSCLE_NAME[slug] || slug}</title>
                </path>
              );
            })
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-center rounded-2xl glass-panel p-4 border border-border/60 ${className}`}>
      {/* Header controls */}
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-gold inline-block animate-pulse" />
          <span>{highlightedMuscles.length} Muscle Groups Targeted</span>
        </div>
        <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveGender("male")}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              activeGender === "male"
                ? "bg-brand-gold text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Male
          </button>
          <button
            type="button"
            onClick={() => setActiveGender("female")}
            className={`px-2 py-0.5 rounded-md font-medium transition-all ${
              activeGender === "female"
                ? "bg-brand-gold text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Female
          </button>
        </div>
      </div>

      {/* SVG Diagrams */}
      <div className="grid grid-cols-2 gap-4 w-full justify-items-center">
        {(view === "both" || view === "front") && renderSvgView("front", "Front View")}
        {(view === "both" || view === "back") && renderSvgView("back", "Back View")}
      </div>

      {/* Interactive Muscle Tooltip / Tags */}
      {showLabels && (
        <div className="mt-3 pt-3 border-t border-border/40 w-full flex flex-wrap gap-1.5 justify-center">
          {highlightedMuscles.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              No muscles detected in routine yet.
            </span>
          ) : (
            highlightedMuscles.map((m) => (
              <span
                key={m}
                onClick={onMuscleClick ? () => onMuscleClick(m) : undefined}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-gold/15 text-brand-gold border border-brand-gold/30 flex items-center gap-1 cursor-pointer hover:bg-brand-gold hover:text-white transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                {MUSCLE_NAME[m] || m}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}
