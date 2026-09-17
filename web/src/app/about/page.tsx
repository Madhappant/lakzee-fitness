import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import Link from "next/link";
import Image from "next/image";
import { Dumbbell, Award, Flame, Users, HeartPulse, ArrowRight } from "lucide-react";

const stats = [
  { label: "Active Athletes", value: "850+" },
  { label: "Certified Trainers", value: "12" },
  { label: "Square Feet Space", value: "10,000+" },
  { label: "Success Transformations", value: "1,200+" }
];

const trainers = [
  {
    name: "Madhappan D",
    role: "Founder & Head Strength Coach",
    specialty: "Hypertrophy & Competitive Powerlifting",
    bio: "Over 8 years sculpting elite athletes and everyday champions with science-backed biomechanics.",
    image: "/logo.jpg"
  },
  {
    name: "Vikram Raj",
    role: "Senior Functional & Conditioning Coach",
    specialty: "Kettlebells, HIIT, Athletic Mobility",
    bio: "Passionate about building functional cardiovascular endurance and injury resilience.",
    image: "/logo.jpg"
  },
  {
    name: "Ananya Sharma",
    role: "Head Nutritionist & Female Wellness Lead",
    specialty: "Macro Coaching, Body Recomposition, Posture",
    bio: "Certified clinical sports nutritionist dedicated to sustainable wellness and fat loss.",
    image: "/logo.jpg"
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-24">
          
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
              <Award className="w-3.5 h-3.5" /> Luxury Fitness Redefined
            </span>
            <h1 className="text-4xl sm:text-6xl font-heading font-black tracking-tight">
              Where Relentless Ambition Meets <span className="gold-gradient-text">Excellence</span>
            </h1>
            <p className="text-muted-foreground text-lg sm:text-xl leading-relaxed">
              Founded on the belief that peak physical health is the ultimate human advantage. Lakzee Fitness is not just a gym—it is an ecosystem crafted for high performers.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="p-8 rounded-3xl bg-card border border-border/80 text-center space-y-2">
                <p className="text-4xl sm:text-5xl font-extrabold font-heading text-brand-gold">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Our Core Pillars */}
          <div className="space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading">Our Core Pillars</h2>
              <p className="text-muted-foreground">The foundation upon which every workout and transformation is built.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-card/60 border border-border space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Olympic-Grade Equipment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Precision-calibrated bars, plates, bio-mechanically engineered pin-loaded stations, and dedicated deadlift platforms.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-card/60 border border-border space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Holistic Health Monitoring</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  From customized diet charts to attendance analytics and routine logging, we track the metrics that drive real outcomes.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-card/60 border border-border space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Inspiring Brotherhood & Culture</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Train alongside dedicated members who push past limits in a clean, high-energy environment free of distraction.
                </p>
              </div>
            </div>
          </div>

          {/* Trainers Section */}
          <div id="trainers" className="space-y-12 scroll-mt-28">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
                <Flame className="w-3.5 h-3.5" /> Certified Experts
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading">Meet Your Coaches</h2>
              <p className="text-muted-foreground">Certified specialists dedicated to unlocking your peak potential safely and sustainably.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {trainers.map((t, i) => (
                <div key={i} className="group rounded-3xl overflow-hidden border border-border bg-card/80 hover:border-brand-gold/40 transition-all p-6 space-y-4">
                  <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-muted">
                    <Image
                      src={t.image}
                      alt={t.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{t.name}</h3>
                    <p className="text-xs text-brand-gold font-semibold uppercase tracking-wider">{t.role}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{t.specialty}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Banner */}
          <div className="rounded-3xl border border-brand-gold/30 bg-gradient-to-r from-card via-brand-gold/10 to-card p-8 sm:p-12 text-center space-y-6 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold font-heading text-foreground">Ready to Elevate Your Standard?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Schedule your introductory consultation and body scan with one of our certified trainers today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
              <Link
                href="/contact"
                className="px-8 py-3.5 rounded-xl bg-brand-gold text-primary-foreground font-bold hover:bg-yellow-500 transition-colors shadow-lg shadow-brand-gold/25 inline-flex items-center justify-center gap-2"
              >
                Book Free Consultation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-3.5 rounded-xl border border-border bg-secondary text-foreground font-semibold hover:bg-muted transition-colors inline-flex items-center justify-center"
              >
                View Plans
              </Link>
            </div>
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
