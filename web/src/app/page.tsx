import Link from "next/link";
import Image from "next/image";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Check, Dumbbell, HeartPulse, CalendarCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors overflow-x-hidden">
      <PublicNavbar />

      {/* Asymmetric Architectural Hero */}
      <section className="py-16 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-border">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Manifesto & Primary Actions */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-heading font-extrabold uppercase tracking-tight leading-[0.95] text-foreground">
              Lakzee Fitness Studio
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-[58ch] leading-relaxed">
              Calibrated Olympic iron, metabolic conditioning turf, and structured coaching built for athletes who measure every session. Zero admission fees.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                href="/pricing"
                className="px-7 py-4 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all text-center focus-gold touch-target"
              >
                See membership plans
              </Link>
              <Link
                href="/member"
                className="px-7 py-4 rounded-lg border border-border bg-card text-foreground font-semibold text-sm hover:border-brand-gold/50 active:scale-[0.98] transition-all text-center focus-gold touch-target"
              >
                Open member portal
              </Link>
            </div>
          </div>

          {/* Right: Studio Specification Ledger */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-card border border-border p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-border">
                <div className="relative w-14 h-14 rounded-full overflow-hidden border border-brand-gold/60 shrink-0">
                  <Image
                    src="/logo.jpg"
                    alt="Lakzee Fitness Studio emblem"
                    fill
                    sizes="56px"
                    priority
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-heading text-2xl font-bold tracking-wide text-foreground">
                    Floor Specifications
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Main Gym Avenue, Tamil Nadu
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border text-sm">
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Training floor</dt>
                  <dd className="font-semibold text-foreground tabular-nums">10,000+ sq ft</dd>
                </div>
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Monday to Saturday</dt>
                  <dd className="font-semibold text-foreground tabular-nums">5:30 AM – 10:00 PM</dd>
                </div>
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Sunday hours</dt>
                  <dd className="font-semibold text-foreground tabular-nums">6:00 AM – 1:00 PM</dd>
                </div>
                <div className="py-3.5 flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Starting membership</dt>
                  <dd className="font-semibold text-brand-gold tabular-nums">₹999 / month</dd>
                </div>
                <div className="pt-3.5 flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Check-in & tracking</dt>
                  <dd className="font-semibold text-foreground">QR pass & routines</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Training Environments — Hairline Architectural Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl sm:text-5xl font-heading font-bold uppercase tracking-tight text-foreground">
              Built for disciplined training
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Every zone on the studio floor is equipped for progressive strength work, sustained conditioning, and simple member logging.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-border rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border bg-card/40">
            <div className="p-8 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                <Dumbbell className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-heading font-bold tracking-wide text-foreground">
                Heavy iron and free weights
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Olympic barbells, custom calibrated plates, deadlift platforms, and dumbbells up to 60 kg.
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                <HeartPulse className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-heading font-bold tracking-wide text-foreground">
                Cardio and conditioning turf
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Curved treadmills, assault bikes, rowing ergometers, and dedicated turf lanes for interval circuits.
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div className="w-10 h-10 rounded-lg bg-brand-gold/10 border border-brand-gold/25 flex items-center justify-center text-brand-gold">
                <CalendarCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-heading font-bold tracking-wide text-foreground">
                Digital member portal
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Instant QR attendance scanning, active subscription tracking, meal plans, and weekly workout splits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Coaching Dossiers */}
      <section id="trainers" className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-xl space-y-3">
              <h2 className="text-3xl sm:text-5xl font-heading font-bold uppercase tracking-tight text-foreground">
                Studio coaching roster
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Hands-on technique feedback and individualized programming tailored to your body metrics and goals.
              </p>
            </div>
            <Link
              href="/about"
              className="text-sm font-semibold text-brand-gold hover:underline focus-gold rounded py-1 w-fit"
            >
              Read studio overview
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-xl bg-card border border-border flex flex-col justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-lg bg-brand-gold text-black font-heading font-extrabold text-2xl flex items-center justify-center shrink-0">
                  MD
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-heading font-bold text-foreground">Madhappan D</h3>
                  <p className="text-sm font-medium text-brand-gold">
                    Founder & Head Strength Coach
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hypertrophy & Powerlifting
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-5">
                Over 8 years coaching competitive lifters and gym members with biomechanically sound form and progressive overload cycles.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border flex flex-col justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-lg bg-secondary border border-brand-gold/40 text-brand-gold font-heading font-extrabold text-2xl flex items-center justify-center shrink-0">
                  SV
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-heading font-bold text-foreground">Sakthi vel</h3>
                  <p className="text-sm font-medium text-brand-gold">
                    Main Coach
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Strength, Conditioning & Physique Transformation
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-5">
                Specializes in athletic performance, compound lifting technique, and high-accountability body recomposition programs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Preview */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 border-b border-border bg-card/30 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-xl space-y-3">
              <h2 className="text-3xl sm:text-5xl font-heading font-bold uppercase tracking-tight text-foreground">
                Straightforward pricing
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Six membership options starting at ₹999 per month with zero registration fees.
              </p>
            </div>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-brand-gold hover:underline focus-gold rounded py-1 w-fit"
            >
              Compare all six plans
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Student */}
            <div className="p-7 rounded-xl bg-card border border-border flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-heading font-bold text-foreground">Student</h3>
                  <p className="text-sm text-muted-foreground">Valid student ID required</p>
                </div>
                <div className="tabular-nums">
                  <span className="text-4xl font-heading font-extrabold text-foreground">₹999</span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground pt-4 border-t border-border">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Full gym floor access
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Cardio zone and locker access
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Mobile QR check-in
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="block text-center py-3 rounded-lg bg-secondary hover:bg-muted font-semibold text-sm text-foreground transition-colors focus-gold touch-target"
              >
                Review student plan
              </Link>
            </div>

            {/* Quarterly (Highlighted Tier) */}
            <div className="p-7 rounded-xl bg-card border-2 border-brand-gold flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-2xl font-heading font-bold text-foreground">Quarterly</h3>
                    <p className="text-sm text-muted-foreground">90-day progression plan</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-brand-gold text-black">
                    Popular
                  </span>
                </div>
                <div className="tabular-nums">
                  <span className="text-4xl font-heading font-extrabold text-brand-gold">₹3,999</span>
                  <span className="text-muted-foreground text-sm"> / 3 months</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground pt-4 border-t border-border">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    All gym zones included
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Personalized diet and macro sheet
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Monthly body assessments
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="block text-center py-3 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all focus-gold touch-target"
              >
                Choose quarterly
              </Link>
            </div>

            {/* Yearly Elite */}
            <div className="p-7 rounded-xl bg-card border border-border flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-heading font-bold text-foreground">Yearly Elite</h3>
                  <p className="text-sm text-muted-foreground">Year-round training access</p>
                </div>
                <div className="tabular-nums">
                  <span className="text-4xl font-heading font-extrabold text-foreground">₹12,999</span>
                  <span className="text-muted-foreground text-sm"> / year</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground pt-4 border-t border-border">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    365 days unrestricted access
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Unlimited trainer consultations
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                    Equals ₹1,083 per month
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="block text-center py-3 rounded-lg bg-secondary hover:bg-muted font-semibold text-sm text-foreground transition-colors focus-gold touch-target"
              >
                See all six tiers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Consultation Walkthrough Band */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto rounded-xl bg-card border border-border p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-heading font-bold uppercase tracking-tight text-foreground">
              Tour the studio before you commit
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Reserve a complimentary day pass, inspect the weight floor, and speak directly with a coach about your training schedule.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <Link
              href="/contact"
              className="px-7 py-3.5 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all text-center focus-gold touch-target"
            >
              Book a walkthrough
            </Link>
            <Link
              href="/pricing"
              className="px-7 py-3.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-secondary active:scale-[0.98] transition-all text-center focus-gold touch-target"
            >
              See all plans
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />

      {/* SEO Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HealthClub",
            "name": "Lakzee Fitness Studio",
            "image": "https://lakzeefitness.com/logo.jpg",
            "url": "https://lakzeefitness.com",
            "telephone": "+919876543210",
            "priceRange": "₹999 - ₹12999",
            "description": "Strength and conditioning gym and health club in Tamil Nadu",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Main Gym Avenue",
              "addressLocality": "City",
              "addressRegion": "Tamil Nadu",
              "addressCountry": "IN"
            }
          })
        }}
      />
    </div>
  );
}
