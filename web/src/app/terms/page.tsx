import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
              <FileText className="w-3.5 h-3.5" /> Studio Rules & Terms
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading font-black tracking-tight">
              Terms of <span className="gold-gradient-text">Service</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: November 2026 • Lakzee Fitness Studio
            </p>
          </div>

          <div className="rounded-3xl bg-card border border-border p-8 sm:p-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">1. Membership & Check-In</h2>
              <p>
                Access to Lakzee Fitness Studio requires an active, non-expired membership subscription and valid QR or Lakzee Member ID verification at the reception desk. Memberships are personal and non-transferable.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">2. Health & Safety Conduct</h2>
              <p>
                Members are responsible for ensuring they are medically fit for exercise. Proper athletic footwear, gym towels, and re-racking weights after use are mandatory on the training floor.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">3. Payments & Renewals</h2>
              <p>
                Subscription fees are billed according to the selected membership tier. Partial balances must be settled prior to plan extension or personal training scheduling.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">4. Support</h2>
              <p>
                Questions regarding membership terms or studio policies can be directed to the front desk or{" "}
                <a href="mailto:support@lakzeefitness.com" className="text-brand-gold hover:underline font-medium">
                  support@lakzeefitness.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
