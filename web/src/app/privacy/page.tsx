import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Data Privacy
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading font-black tracking-tight">
              Privacy <span className="gold-gradient-text">Policy</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: November 2026 • Lakzee Fitness Studio
            </p>
          </div>

          <div className="rounded-3xl bg-card border border-border p-8 sm:p-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2>
              <p>
                We collect information necessary to manage your membership, personalize fitness and nutrition plans, process payments, and track studio check-ins. This includes your name, email address, phone number, emergency contact, membership status, and optional fitness assessment metrics.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">2. How We Use Your Data</h2>
              <p>
                Your personal information is used strictly to deliver gym access via QR pass verification, provide trainer-prescribed diet and workout programs, send membership renewal notifications, and respond to consultation inquiries.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">3. Data Security & Retention</h2>
              <p>
                All authentication credentials are encrypted using industry-standard hashing and transmitted over HTTPS. We never sell or rent member contact details to third-party marketers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">4. Contact Us</h2>
              <p>
                For data access, correction, or deletion requests, please email us at{" "}
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
