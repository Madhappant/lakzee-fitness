import Link from "next/link";
import Image from "next/image";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { 
  Dumbbell, 
  Sparkles, 
  CalendarCheck, 
  Flame, 
  ArrowRight, 
  Check, 
  HeartPulse 
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors overflow-x-hidden">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Decorative Gold Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/30 backdrop-blur-md shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Luxury Gym Experience
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-brand-gold/50 shadow-2xl shadow-brand-gold/20">
              <Image 
                src="/logo.jpg" 
                alt="Lakzee Fitness Studio Logo" 
                fill 
                sizes="(max-width: 640px) 96px, 112px"
                priority 
                className="object-cover" 
              />
            </div>
            <h1 className="text-5xl sm:text-7xl font-heading font-black tracking-tight text-foreground">
              LAKZEE <span className="gold-gradient-text">FITNESS</span>
            </h1>
          </div>

          <p className="text-lg sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-body">
            Where relentless ambition meets luxury conditioning. State-of-the-art strength zones, tailored nutrition, and elite coaching.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground font-bold text-base shadow-xl shadow-brand-gold/25 hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              Explore Membership Plans <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/member"
              className="w-full sm:w-auto px-8 py-4 rounded-xl glass text-foreground font-semibold text-base hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Dumbbell className="w-4 h-4 text-brand-gold" /> Member Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border/40 bg-card/30 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-gold">World-Class Facilities</span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-foreground">
              Engineered For Pure Performance
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Every square foot is optimized for athletic longevity, biomechanical precision, and unmatched energy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                <Dumbbell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Heavy Iron & Free Weights</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Olympic barbells, custom calibrated plates, and dumbbells ranging up to 60kg for serious lifters.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                <HeartPulse className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Cardio & Metabolic Conditioning</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Curved treadmills, assault bikes, rowing machines, and turf tracks for high-intensity interval training.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-card border border-border/70 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Smart Digital Member Portal</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Scan-and-go QR attendance, real-time subscription tracking, personalized diet plans, and workout routines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trainers Section */}
      <section id="trainers" className="py-24 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-gold">Master Coaches</span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-foreground">
              Guided by Industry Veterans
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Our internationally certified trainers design personalized pathways to surpass your personal bests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-card border border-border/80 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-muted">
                <Image src="/logo.jpg" alt="Madhappan D" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Madhappan D</h3>
                <p className="text-xs text-brand-gold font-semibold uppercase tracking-wider">Head Strength & Conditioning Coach</p>
                <p className="text-xs text-muted-foreground mt-1">Specialty: Hypertrophy & Powerlifting</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                8+ years sculpting competitive athletes with biomechanically sound programming and progressive overload.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border/80 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-muted">
                <Image src="/logo.jpg" alt="Vikram Raj" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Vikram Raj</h3>
                <p className="text-xs text-brand-gold font-semibold uppercase tracking-wider">Functional Agility Coach</p>
                <p className="text-xs text-muted-foreground mt-1">Specialty: HIIT, Kettlebell & Mobility</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Specialized in functional joint longevity, metabolic conditioning, and athletic injury prevention.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border/80 hover:border-brand-gold/40 transition-all space-y-4">
              <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-muted">
                <Image src="/logo.jpg" alt="Ananya Sharma" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Ananya Sharma</h3>
                <p className="text-xs text-brand-gold font-semibold uppercase tracking-wider">Clinical Sports Nutritionist</p>
                <p className="text-xs text-muted-foreground mt-1">Specialty: Macro Cycling & Fat Loss</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Empowering members with custom metabolic meal plans that fuel high performance without restrictive dieting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border/40 bg-card/30 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-gold">Membership Plans</span>
            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-foreground">
              Flexible Tiers For Every Ambition
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Starting from only ₹999/month with zero admission fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Student */}
            <div className="p-8 rounded-3xl bg-card border border-border flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Student Plan</h3>
                <p className="text-sm text-muted-foreground mt-1">For active college athletes</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold font-heading text-foreground">₹999</span>
                  <span className="text-muted-foreground text-sm"> / month</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Full gym floor access</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Cardio & locker access</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Mobile QR attendance</li>
                </ul>
              </div>
              <Link href="/pricing" className="block text-center py-3 rounded-xl bg-secondary hover:bg-muted font-bold text-sm transition-colors">
                View Plan Details
              </Link>
            </div>

            {/* Quarterly (Featured) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-card to-brand-gold/10 border-2 border-brand-gold shadow-2xl shadow-brand-gold/10 flex flex-col justify-between space-y-6 scale-105">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-gold text-primary-foreground">
                  Most Popular
                </span>
                <h3 className="text-2xl font-bold text-foreground mt-3">Quarterly Plan</h3>
                <p className="text-sm text-muted-foreground mt-1">Recommended for transformation</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold font-heading text-foreground">₹3,999</span>
                  <span className="text-muted-foreground text-sm"> / 3 months</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> All gym features included</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Personalized diet & macros</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Monthly body scans</li>
                </ul>
              </div>
              <Link href="/pricing" className="block text-center py-3 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground font-bold text-sm shadow-lg shadow-brand-gold/20 hover:brightness-110 transition-all">
                Select Quarterly
              </Link>
            </div>

            {/* Yearly Elite */}
            <div className="p-8 rounded-3xl bg-card border border-border flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Yearly Elite</h3>
                <p className="text-sm text-muted-foreground mt-1">Maximum value & perks</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold font-heading text-foreground">₹12,999</span>
                  <span className="text-muted-foreground text-sm"> / year</span>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> 365 Days unrestricted access</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Unlimited PT consultations</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-brand-gold" /> Just ₹1,083/month value</li>
                </ul>
              </div>
              <Link href="/pricing" className="block text-center py-3 rounded-xl bg-secondary hover:bg-muted font-bold text-sm transition-colors">
                View All 6 Plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Consultation CTA Section */}
      <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-card via-card to-brand-gold/10 border border-brand-gold/30 p-8 sm:p-14 shadow-2xl text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
            <Flame className="w-3.5 h-3.5" /> Start Today
          </span>
          <h2 className="text-3xl sm:text-5xl font-heading font-black text-foreground">
            Claim Your Free Session Pass
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base sm:text-lg">
            Experience our machines, vibe, and community firsthand. Speak with our trainers and find the perfect regimen for your lifestyle.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href="/contact"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-brand-gold text-primary-foreground font-bold text-base hover:bg-yellow-500 transition-colors shadow-lg shadow-brand-gold/25"
            >
              Book Free Consultation
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-base hover:bg-secondary transition-colors"
            >
              Browse Membership Plans
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
            "description": "Enterprise Luxury Gym and Health Club in Tamil Nadu",
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

