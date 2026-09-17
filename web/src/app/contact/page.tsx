"use client";

import { useState } from "react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2, MessageSquare } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    goal: "WEIGHT_LOSS",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <PublicNavbar />

      <main className="flex-1 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
              <MessageSquare className="w-3.5 h-3.5" /> Direct Inquiry
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading font-black tracking-tight">
              Begin Your <span className="gold-gradient-text">Journey</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Visit our studio for a tour or book a complimentary fitness assessment and trainer consultation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
            
            {/* Left: Contact Info & Hours */}
            <div className="lg:col-span-5 space-y-8">
              <div className="rounded-3xl bg-card border border-border p-8 space-y-6">
                <h2 className="text-2xl font-bold font-heading">Studio Headquarters</h2>
                
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-brand-gold shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-foreground">Location</p>
                      <p className="text-muted-foreground">Lakzee Fitness Studio, Main Gym Avenue, Tamil Nadu, India</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-brand-gold shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-foreground">Phone & WhatsApp</p>
                      <a href="tel:+919876543210" className="text-brand-gold hover:underline font-medium">+91 98765 43210</a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-brand-gold shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-foreground">Email</p>
                      <a href="mailto:support@lakzeefitness.com" className="text-brand-gold hover:underline font-medium">support@lakzeefitness.com</a>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-3">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-gold" /> Workout Hours
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-secondary/50">
                      <p className="font-bold text-foreground">Mon – Sat</p>
                      <p className="text-muted-foreground">5:30 AM – 10:00 PM</p>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/50">
                      <p className="font-bold text-foreground">Sunday</p>
                      <p className="text-muted-foreground">6:00 AM – 1:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Trial Badge Card */}
              <div className="rounded-3xl bg-brand-gold/10 border border-brand-gold/30 p-6 space-y-2">
                <p className="text-brand-gold font-bold text-sm">Complimentary Day Pass</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  First-time visitors enjoy a free day workout pass and initial body-fat metric check upon appointment confirmation.
                </p>
              </div>
            </div>

            {/* Right: Consultation Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl bg-card border border-border p-8 sm:p-10 shadow-xl">
                {submitted ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Consultation Booked!</h2>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Thank you, <span className="font-bold text-foreground">{form.name}</span>. Our head coach will reach out to you via WhatsApp / Phone at <span className="font-bold text-brand-gold">{form.phone}</span> within 2 business hours.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="mt-4 px-6 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold font-heading mb-1">Book Free Consultation</h2>
                      <p className="text-sm text-muted-foreground">Fill in your details and we will reserve your session.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Your Full Name</label>
                        <input
                          required
                          type="text"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          placeholder="e.g. John Doe"
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-gold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Phone / WhatsApp</label>
                        <input
                          required
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-gold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Email Address</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          placeholder="john@example.com"
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-gold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Primary Fitness Goal</label>
                        <select
                          value={form.goal}
                          onChange={e => setForm({ ...form, goal: e.target.value })}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-gold outline-none"
                        >
                          <option value="WEIGHT_LOSS">Weight Loss & Shredding</option>
                          <option value="MUSCLE_BUILDING">Muscle Hypertrophy & Bulk</option>
                          <option value="STRENGTH">Powerlifting & Core Strength</option>
                          <option value="CARDIO">Cardiovascular Endurance</option>
                          <option value="REHAB">Mobility & Posture Rehab</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-foreground">Notes or Medical History (Optional)</label>
                      <textarea
                        rows={3}
                        value={form.message}
                        onChange={e => setForm({ ...form, message: e.target.value })}
                        placeholder="Tell us about any specific preferences, prior workout experience, or goals..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-gold outline-none resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground font-bold text-sm shadow-lg shadow-brand-gold/25 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Confirm Free Consultation
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
