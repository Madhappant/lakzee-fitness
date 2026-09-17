"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, Dumbbell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-full overflow-hidden border border-brand-gold/40 group-hover:border-brand-gold transition-colors shadow-lg shadow-brand-gold/10">
              <Image 
                src="/logo.jpg" 
                alt="Lakzee Fitness Studio Logo" 
                fill 
                sizes="44px"
                className="object-cover" 
                priority 
              />
            </div>
            <div>
              <span className="text-xl font-heading font-extrabold tracking-tight">
                LAKZEE <span className="gold-gradient-text">FITNESS</span>
              </span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-1 font-semibold">
                Luxury Studio
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-foreground hover:text-brand-gold transition-colors">
              Home
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground hover:text-brand-gold transition-colors">
              Membership Plans
            </Link>
            <Link href="/#trainers" className="text-muted-foreground hover:text-foreground hover:text-brand-gold transition-colors">
              Trainers
            </Link>
            <Link href="/about" className="text-muted-foreground hover:text-foreground hover:text-brand-gold transition-colors">
              About Studio
            </Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground hover:text-brand-gold transition-colors">
              Contact & Location
            </Link>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/60 hover:border-brand-gold/40 transition-all"
            >
              Staff Login
            </Link>
            <Link
              href="/member"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-primary-foreground text-xs font-bold shadow-lg shadow-brand-gold/20 hover:brightness-110 transition-all"
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Member Portal
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl border border-border text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-brand-gold"
          >
            Home
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-brand-gold"
          >
            Membership Plans
          </Link>
          <Link
            href="/#trainers"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-brand-gold"
          >
            Trainers
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-brand-gold"
          >
            About Studio
          </Link>
          <Link
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-sm font-medium text-muted-foreground hover:text-brand-gold"
          >
            Contact & Location
          </Link>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            <Link
              href="/member"
              onClick={() => setMobileOpen(false)}
              className="text-center py-3 rounded-xl bg-brand-gold text-primary-foreground font-bold text-sm"
            >
              Member Portal
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-center py-2.5 rounded-xl border border-border text-foreground text-sm font-medium"
            >
              Staff Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
