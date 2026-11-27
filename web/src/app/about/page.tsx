import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import Link from "next/link";
import { Dumbbell, Users, HeartPulse } from "lucide-react";

const stats = [
  { label: "Active athletes", value: "850+" },
  { label: "Certified coaches", value: "12" },
  { label: "Training floor space", value: "10,000+ sq ft" },
  { label: "Completed transformations", value: "1,200+" },
];

const trainers = [
  {
    initials: "MD",
    name: "Madhappan D",
    role: "Founder & Head Strength Coach",
    specialty: "Hypertrophy & Competitive Powerlifting",
    bio: "Over 8 years coaching competitive athletes and everyday lifters with biomechanically sound programming and progressive overload.",
    highlight: true,
  },
  {
    initials: "SV",
    name: "Sakthi vel",
    role: "Main Coach",
    specialty: "Strength, Conditioning & Physique Transformation",
    bio: "Focuses on athletic performance, compound lifting mechanics, and structured body transformation plans.",
    highlight: false,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-20">
          {/* Intro */}
          <div className="max-w-3xl space-y-5 border-b border-border pb-10">
            <h1 className="text-4xl sm:text-6xl font-heading font-extrabold uppercase tracking-tight text-foreground">
              Built around strength, form, and consistency
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-[65ch]">
              Lakzee Fitness Studio was established in Tamil Nadu to give lifters, students, and working professionals an organized training floor with calibrated equipment, attentive coaching, and clear progress tracking.
            </p>
          </div>

          {/* Studio Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border bg-card">
            {stats.map((stat, i) => (
              <div key={i} className="p-6 sm:p-8 space-y-1.5">
                <p className="text-3xl sm:text-4xl font-extrabold font-heading text-brand-gold tabular-nums">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Training Principles */}
          <div className="space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading uppercase text-foreground">
                How the studio operates
              </h2>
              <p className="text-muted-foreground text-base">
                Three practical standards that govern our equipment floor and coaching practice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-7 rounded-xl bg-card border border-border space-y-3">
                <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                  <Dumbbell className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Olympic-grade floor</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Calibrated bars and plates, engineered resistance stations, and dedicated platforms kept in clean working order.
                </p>
              </div>

              <div className="p-7 rounded-xl bg-card border border-border space-y-3">
                <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                  <HeartPulse className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Structured tracking</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Members receive individualized nutrition targets, workout splits, and attendance logs inside their portal.
                </p>
              </div>

              <div className="p-7 rounded-xl bg-card border border-border space-y-3">
                <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                  <Users className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Focused atmosphere</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Respectful gym culture where members train alongside peers without crowding or clutter.
                </p>
              </div>
            </div>
          </div>

          {/* Coaches */}
          <div id="trainers" className="space-y-8 scroll-mt-24">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading uppercase text-foreground">
                Meet the coaches
              </h2>
              <p className="text-muted-foreground text-base">
                Certified coaches guiding technique, programming, and safe progression.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trainers.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-8 flex flex-col justify-between gap-6"
                >
                  <div className="flex items-start gap-5">
                    <div
                      className={`w-14 h-14 rounded-lg font-heading font-extrabold text-2xl flex items-center justify-center shrink-0 ${
                        t.highlight
                          ? "bg-brand-gold text-black"
                          : "bg-secondary border border-brand-gold/40 text-brand-gold"
                      }`}
                    >
                      {t.initials}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-heading font-bold text-foreground">{t.name}</h3>
                      <p className="text-sm text-brand-gold font-medium">{t.role}</p>
                      <p className="text-xs text-muted-foreground">{t.specialty}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-5">
                    {t.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Walkthrough CTA */}
          <div className="rounded-xl border border-border bg-card p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">
                Visit the gym in person
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Schedule an introductory session and body scan with our coaching staff.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/contact"
                className="px-7 py-3.5 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all text-center focus-gold touch-target"
              >
                Book a walkthrough
              </Link>
              <Link
                href="/pricing"
                className="px-7 py-3.5 rounded-lg border border-border bg-secondary text-foreground font-semibold text-sm hover:bg-muted active:scale-[0.98] transition-all text-center focus-gold touch-target"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
