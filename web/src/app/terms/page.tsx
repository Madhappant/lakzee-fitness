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
            <h1 className="text-4xl sm:text-5xl font-heading font-extrabold uppercase tracking-tight text-foreground">
              Terms of Service
            </h1>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
              <span>Last updated: November 2026</span>
            </p>
          </div>

          <div className="rounded-xl bg-card border border-border p-8 sm:p-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
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
