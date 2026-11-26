"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Dumbbell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Membership Plans", href: "/pricing" },
    { name: "Trainers", href: "/#trainers" },
    { name: "About Studio", href: "/about" },
    { name: "Contact & Location", href: "/contact" },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group focus-gold rounded-xl p-1">
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
          <div className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-xl transition-all duration-200 focus-gold ${
                    isActive
                      ? "text-brand-gold bg-brand-gold/10 font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="touch-target px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/60 hover:border-brand-gold/40 hover:bg-white/5 transition-all focus-gold"
            >
              Staff Login
            </Link>
            <Link
              href="/member"
              className="touch-target gap-2 px-5 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-black text-xs font-bold shadow-lg shadow-brand-gold/20 hover:brightness-110 active:scale-95 transition-all focus-gold"
            >
              <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" />
              Member Portal
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="touch-target rounded-xl border border-border text-foreground hover:bg-muted/50 transition-colors focus-gold"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center h-12 px-4 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "text-brand-gold bg-brand-gold/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="pt-4 border-t border-border flex flex-col gap-2.5">
            <Link
              href="/member"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-brand-gold to-yellow-500 text-black font-bold text-sm shadow-md"
            >
              <Dumbbell className="w-4 h-4" aria-hidden="true" />
              Member Portal
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center h-12 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-white/5"
            >
              Staff Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
