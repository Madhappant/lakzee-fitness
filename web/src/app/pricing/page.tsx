import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

const plans = [
  {
    name: "Student",
    price: "₹999",
    period: "/month",
    description: "Designed for college students training between classes.",
    features: [
      "Full gym floor access all day",
      "Cardio and strength zone",
      "Locker and shower facilities",
      "QR app attendance check-in",
      "Valid student ID required",
    ],
    popular: false,
    cta: "Select Student plan",
  },
  {
    name: "Monthly",
    price: "₹1,499",
    period: "/month",
    description: "Flexible month-to-month access with no long-term lock-in.",
    features: [
      "Full gym floor access",
      "Free weights and pin-loaded machines",
      "Locker and shower facilities",
      "Member portal routine tracking",
      "Orientation and form basics",
    ],
    popular: false,
    cta: "Select Monthly plan",
  },
  {
    name: "Quarterly",
    price: "₹3,999",
    period: "/3 months",
    description: "Built for consistent physique and strength progression.",
    features: [
      "All Monthly access included",
      "Personalized diet and macro plan",
      "Monthly body composition check",
      "Conditioning turf zone access",
      "Saves ₹500 over monthly billing",
    ],
    popular: true,
    badge: "Most popular",
    cta: "Select Quarterly plan",
  },
  {
    name: "Half Year",
    price: "₹7,499",
    period: "/6 months",
    description: "Structured six-month commitment for dedicated lifters.",
    features: [
      "All Quarterly features included",
      "2 one-on-one personal training sessions",
      "Custom macro and nutrition adjustments",
      "Locker reservation priority",
      "Priority entry to studio events",
    ],
    popular: false,
    cta: "Select Half Year plan",
  },
  {
    name: "Yearly Elite",
    price: "₹12,999",
    period: "/year",
    description: "Full-year unrestricted access with ongoing coaching support.",
    features: [
      "365 days unrestricted access",
      "Unlimited trainer consultations",
      "Periodic diet plan updates",
      "Lakzee Fitness studio kit",
      "Lowest rate at ₹1,083 per month",
    ],
    popular: false,
    badge: "Best value",
    cta: "Select Yearly Elite",
  },
  {
    name: "Couple / Buddy",
    price: "₹2,499",
    period: "/month for 2",
    description: "Shared monthly pass for two partners training together.",
    features: [
      "Simultaneous gym access for 2 members",
      "Shared intake consultation",
      "Partner workout routine setup",
      "Conditioning circuit zone access",
      "Dual QR attendance profiles",
    ],
    popular: false,
    cta: "Select Buddy plan",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-14">
          {/* Header */}
          <div className="max-w-2xl space-y-3 border-b border-border pb-8">
            <h1 className="text-4xl sm:text-6xl font-heading font-extrabold uppercase tracking-tight text-foreground">
              Membership Plans
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Every tier includes full training floor access, locker facilities, and digital member check-in with zero hidden admission charges.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col justify-between rounded-xl p-7 transition-colors border ${
                  plan.popular
                    ? "bg-card border-2 border-brand-gold"
                    : "bg-card/80 border-border hover:border-brand-gold/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-2xl font-bold font-heading text-foreground">{plan.name}</h2>
                    {plan.badge && (
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          plan.popular
                            ? "bg-brand-gold text-black"
                            : "bg-secondary text-brand-gold border border-brand-gold/30"
                        }`}
                      >
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground min-h-[40px] mb-5">
                    {plan.description}
                  </p>

                  <div className="flex items-baseline gap-1.5 mb-6 tabular-nums">
                    <span className={`text-4xl font-extrabold font-heading ${plan.popular ? "text-brand-gold" : "text-foreground"}`}>
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-foreground">Included features</p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8 mt-4">
                  <Link
                    href="/contact"
                    className={`w-full block text-center py-3 px-5 rounded-lg font-bold text-sm transition-all focus-gold touch-target ${
                      plan.popular
                        ? "bg-brand-gold text-black hover:brightness-110 active:scale-[0.98]"
                        : "bg-secondary text-foreground hover:bg-brand-gold hover:text-black active:scale-[0.98]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Custom / Trial Band */}
          <div className="rounded-xl border border-border bg-card p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 text-brand-gold text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Zero admission fee policy
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">
                Need corporate or personal training pricing?
              </h2>
              <p className="text-sm text-muted-foreground">
                Schedule a quick floor walkthrough and talk directly with a coach about custom schedules.
              </p>
            </div>
            <Link
              href="/contact"
              className="shrink-0 px-7 py-3.5 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all focus-gold touch-target"
            >
              Book a free trial
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
