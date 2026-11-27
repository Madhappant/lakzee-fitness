"use client";

import { useState } from "react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { API_URL } from "@/lib/api/config";
import { MapPin, Phone, Mail, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    goal: "WEIGHT_LOSS",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Could not send request. Please verify your details and try again.");
      }
      setSubmitted(true);
      toast.success("Walkthrough request saved");
    } catch (err: unknown) {
      const msg = (err as Error).message || "Could not reach the server. Please try again.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="max-w-2xl space-y-3 border-b border-border pb-8">
            <h1 className="text-4xl sm:text-6xl font-heading font-extrabold uppercase tracking-tight text-foreground">
              Book a gym walkthrough
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Visit the training floor for an equipment tour and a complimentary session with a coach.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left: Contact Info & Hours */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-xl bg-card border border-border p-7 space-y-6">
                <h2 className="text-2xl font-bold font-heading text-foreground">Studio location</h2>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground">Address</p>
                      <p className="text-muted-foreground">Lakzee Fitness Studio, Main Gym Avenue, Tamil Nadu, India</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground">Phone and WhatsApp</p>
                      <a href="tel:+919876543210" className="text-brand-gold hover:underline font-medium focus-gold rounded">
                        +91 98765 43210
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground">Email</p>
                      <a href="mailto:support@lakzeefitness.com" className="text-brand-gold hover:underline font-medium focus-gold rounded">
                        support@lakzeefitness.com
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-3">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-gold" aria-hidden="true" />
                    Workout hours
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-secondary">
                      <p className="font-semibold text-foreground">Mon – Sat</p>
                      <p className="text-muted-foreground tabular-nums mt-0.5">5:30 AM – 10:00 PM</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary">
                      <p className="font-semibold text-foreground">Sunday</p>
                      <p className="text-muted-foreground tabular-nums mt-0.5">6:00 AM – 1:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-card border border-brand-gold/40 p-6 space-y-2">
                <p className="text-brand-gold font-semibold text-sm">Complimentary trial session</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  First-time visitors receive one free training pass and an introductory body assessment after booking.
                </p>
              </div>
            </div>

            {/* Right: Consultation Form */}
            <div className="lg:col-span-7">
              <div className="rounded-xl bg-card border border-border p-7 sm:p-9">
                {submitted ? (
                  <div className="text-center py-10 space-y-4">
                    <div className="w-14 h-14 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold font-heading text-foreground">Walkthrough booked</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Thank you, <span className="font-semibold text-foreground">{form.name}</span>. A coach will call or WhatsApp <span className="font-semibold text-brand-gold">{form.phone}</span> within 2 business hours to confirm your slot.
                    </p>
                    <button
                      onClick={() => {
                        setForm({ name: "", phone: "", email: "", goal: "WEIGHT_LOSS", message: "" });
                        setSubmitted(false);
                      }}
                      className="mt-2 px-6 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-secondary active:scale-[0.98] transition-all focus-gold touch-target"
                    >
                      Book another walkthrough
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-2xl font-bold font-heading text-foreground mb-1">Request a consultation</h2>
                      <p className="text-sm text-muted-foreground">Share your contact details and preferred focus area.</p>
                    </div>

                    {submitError && (
                      <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                        {submitError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="contact-name" className="block text-sm font-medium mb-1.5 text-foreground">
                          Full name
                        </label>
                        <input
                          id="contact-name"
                          required
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Your name"
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus-gold outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-phone" className="block text-sm font-medium mb-1.5 text-foreground">
                          Phone or WhatsApp
                        </label>
                        <input
                          id="contact-phone"
                          required
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus-gold outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="contact-email" className="block text-sm font-medium mb-1.5 text-foreground">
                          Email address (optional)
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="you@example.com"
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus-gold outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-goal" className="block text-sm font-medium mb-1.5 text-foreground">
                          Primary training goal
                        </label>
                        <select
                          id="contact-goal"
                          value={form.goal}
                          onChange={(e) => setForm({ ...form, goal: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus-gold outline-none transition-all"
                        >
                          <option value="WEIGHT_LOSS">Fat loss and conditioning</option>
                          <option value="MUSCLE_BUILDING">Hypertrophy and muscle gain</option>
                          <option value="STRENGTH">Powerlifting and strength</option>
                          <option value="CARDIO">Cardiovascular endurance</option>
                          <option value="REHAB">Mobility and posture rehab</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-notes" className="block text-sm font-medium mb-1.5 text-foreground">
                        Notes or injury history (optional)
                      </label>
                      <textarea
                        id="contact-notes"
                        rows={3}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="Mention preferred workout times or training experience..."
                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus-gold outline-none transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] py-3.5 px-6 rounded-lg bg-brand-gold text-black font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus-gold touch-target disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      {isSubmitting ? "Booking walkthrough..." : "Book walkthrough"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
