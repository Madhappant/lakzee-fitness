import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import Link from "next/link";
import { Check, Sparkles, Dumbbell, ShieldCheck, Zap } from "lucide-react";

const plans = [
  {
    name: "Student",
    price: "₹999",
    period: "/month",
    description: "Ideal for college students with valid student ID seeking premium training.",
    features: [
      "Full Gym Access (All Day)",
      "Cardio & Strength Zone",
      "Locker & Shower Access",
      "Mobile App Attendance & QR Check-in",
      "Valid Student ID Required"
    ],
    popular: false,
    cta: "Join as Student"
  },
  {
    name: "Monthly",
    price: "₹1,499",
    period: "/month",
    description: "Flexible monthly fitness access with zero long-term commitment.",
    features: [
      "Full Gym Floor Access",
      "Free Weights & Resistance Machines",
      "Locker & Shower Facilities",
      "Member Portal & Routine Tracking",
      "Basic Workout Guidance"
    ],
    popular: false,
    cta: "Start Monthly"
  },
  {
    name: "Quarterly",
    price: "₹3,999",
    period: "/3 months",
    description: "The sweet spot for consistent physique progression and transformation.",
    features: [
      "All Monthly Features Included",
      "Personalized Diet & Nutrition Plan",
      "Monthly Body Composition Assessment",
      "Cardio & Functional Training Zone",
      "Save ₹500 vs monthly billing"
    ],
    popular: true,
    badge: "Most Popular",
    cta: "Get Quarterly Plan"
  },
  {
    name: "Half Year",
    price: "₹7,499",
    period: "/6 months",
    description: "Serious commitment for dedicated fitness enthusiasts and athletes.",
    features: [
      "All Quarterly Features Included",
      "2 Dedicated 1-on-1 Personal Training Sessions",
      "Custom Macro & Nutrition Breakdown",
      "Locker Reservation Privileges",
      "Priority Access to Studio Events"
    ],
    popular: false,
    cta: "Join for 6 Months"
  },
  {
    name: "Yearly Elite",
    price: "₹12,999",
    period: "/year",
    description: "Ultimate luxury membership with VIP perks and unlimited consultations.",
    features: [
      "Full 365 Days Unrestricted Access",
      "Unlimited Personal Trainer Consultations",
      "Custom Periodic Diet Adjustments",
      "Complimentary Lakzee Fitness Merchandise",
      "Best Value: Just ₹1,083/month"
    ],
    popular: false,
    badge: "Best Value",
    cta: "Go Elite Yearly"
  },
  {
    name: "Couple / Buddy",
    price: "₹2,499",
    period: "/month for 2",
    description: "Train together with your partner or workout partner and achieve goals together.",
    features: [
      "Simultaneous Access for 2 Members",
      "Shared Consultation & Assessment",
      "Partner Workout Routines",
      "Group Circuit Training Access",
      "Double Motivation & Support"
    ],
    popular: false,
    cta: "Join Together"
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
              <Sparkles className="w-3.5 h-3.5" /> Transparent Pricing
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading font-black tracking-tight">
              Invest in Your <span className="gold-gradient-text">Greatness</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              No hidden admission fees. State-of-the-art equipment, personalized guidance, and unmatched studio hygiene.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all duration-300 border ${
                  plan.popular
                    ? "bg-gradient-to-b from-card via-card to-brand-gold/5 border-brand-gold shadow-2xl shadow-brand-gold/10 scale-[1.02]"
                    : "bg-card/70 border-border hover:border-brand-gold/40 hover:shadow-xl"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold font-heading text-foreground">{plan.name}</h3>
                    <Dumbbell className={`w-6 h-6 ${plan.popular ? "text-brand-gold" : "text-muted-foreground"}`} />
                  </div>
                  
                  <p className="text-sm text-muted-foreground min-h-[40px] mb-6">
                    {plan.description}
                  </p>

                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-4xl font-extrabold font-heading text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What&apos;s Included:</p>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8 mt-6">
                  <Link
                    href="/contact"
                    className={`w-full block text-center py-3.5 px-6 rounded-xl font-bold text-sm transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground shadow-lg shadow-brand-gold/25 hover:brightness-110"
                        : "bg-secondary text-foreground hover:bg-brand-gold hover:text-primary-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Guarantee / FAQ Card */}
          <div className="rounded-3xl border border-border bg-card/40 p-8 sm:p-12 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-brand-gold text-sm font-bold">
                <ShieldCheck className="w-5 h-5" /> 100% Commitment Guarantee
              </div>
              <h2 className="text-2xl font-bold text-foreground">Want a customized corporate or personal plan?</h2>
              <p className="text-sm text-muted-foreground">
                Speak directly with our head trainers to formulate a tailor-made regime for you.
              </p>
            </div>
            <Link
              href="/contact"
              className="shrink-0 px-8 py-4 rounded-xl bg-brand-gold text-primary-foreground font-bold text-sm hover:bg-yellow-500 transition-colors shadow-lg shadow-brand-gold/20 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Book Free Trial
            </Link>
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
