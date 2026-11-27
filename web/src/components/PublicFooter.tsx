import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-card/60 border-t border-border text-muted-foreground pt-14 pb-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full overflow-hidden border border-brand-gold/40">
                <Image src="/logo.jpg" alt="Lakzee Fitness" fill sizes="36px" className="object-cover" />
              </div>
              <span className="text-lg font-heading font-bold tracking-wide text-foreground">
                Lakzee Fitness
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Strength and conditioning studio in Tamil Nadu with calibrated weights, structured coaching, and member tracking.
            </p>
          </div>

          {/* Col 2: Quick Navigation */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  Membership plans
                </Link>
              </li>
              <li>
                <Link href="/#trainers" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  Coaches
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  About studio
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  Book a walkthrough
                </Link>
              </li>
              <li>
                <Link href="/member" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
                  Member portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Studio Hours */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Training hours</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Monday to Saturday</p>
                  <p className="text-xs">5:30 AM – 10:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Sunday</p>
                  <p className="text-xs">6:00 AM – 1:00 PM</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" aria-hidden="true" />
                <span>Main Gym Avenue, Tamil Nadu, India</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                <a href="tel:+919876543210" className="hover:text-brand-gold transition-colors focus-gold rounded">
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-gold shrink-0" aria-hidden="true" />
                <a href="mailto:support@lakzeefitness.com" className="hover:text-brand-gold transition-colors focus-gold rounded">
                  support@lakzeefitness.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-7 flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
          <p>© {new Date().getFullYear()} Lakzee Fitness Studio. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
              Terms of service
            </Link>
            <Link href="/login" className="hover:text-brand-gold transition-colors focus-gold rounded py-0.5">
              Staff sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
