import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-card/80 border-t border-border/60 text-muted-foreground pt-16 pb-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Col 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-gold/40">
                <Image src="/logo.jpg" alt="Lakzee Fitness" fill sizes="40px" className="object-cover" />
              </div>
              <span className="text-xl font-heading font-extrabold text-foreground">
                LAKZEE <span className="gold-gradient-text">FITNESS</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              Premium health and strength sanctuary dedicated to transforming bodies, minds, and lifestyles with elite equipment and world-class trainers.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:text-brand-gold transition-colors">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:text-brand-gold transition-colors">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.5 5H18V0h-3.808C10.595 0 9 1.583 9 4.615V8z"/></svg>
              </a>
              <a href="#" aria-label="YouTube" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground hover:text-brand-gold transition-colors">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Quick Navigation</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/" className="hover:text-brand-gold transition-colors">Home</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-gold transition-colors">Membership Plans</Link></li>
              <li><Link href="/#trainers" className="hover:text-brand-gold transition-colors">Elite Trainers</Link></li>
              <li><Link href="/about" className="hover:text-brand-gold transition-colors">About Our Studio</Link></li>
              <li><Link href="/contact" className="hover:text-brand-gold transition-colors">Book Consultation</Link></li>
              <li><Link href="/member" className="hover:text-brand-gold transition-colors">Member Portal</Link></li>
            </ul>
          </div>

          {/* Col 3: Hours */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Studio Hours</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Monday – Saturday</p>
                  <p className="text-xs">05:30 AM – 10:00 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2 pt-2">
                <Clock className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Sunday</p>
                  <p className="text-xs">06:00 AM – 01:00 PM</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Contact & Studio</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <span>Lakzee Fitness Studio, Main Gym Avenue, Tamil Nadu, India</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-gold shrink-0" />
                <a href="tel:+919876543210" className="hover:text-brand-gold transition-colors">+91 98765 43210</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-gold shrink-0" />
                <a href="mailto:support@lakzeefitness.com" className="hover:text-brand-gold transition-colors">support@lakzeefitness.com</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom */}
        <div className="border-t border-border/60 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
          <p>© {new Date().getFullYear()} Lakzee Fitness Studio. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-brand-gold transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-brand-gold transition-colors">Terms of Service</Link>
            <Link href="/login" className="hover:text-brand-gold transition-colors">Staff Access</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
