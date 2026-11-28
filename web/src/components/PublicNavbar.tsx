"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Plans", href: "/pricing" },
    { name: "Coaches", href: "/#trainers" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full apple-glass border-x-0 border-t-0 rounded-none border-b border-border transition-colors safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Emblem + Wordmark */}
          <Link href="/" className="flex items-center gap-3 group focus-gold rounded-lg p-1">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-gold/50 shrink-0">
              <Image
                src="/logo.jpg"
                alt="Lakzee Fitness Studio"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>
            <span className="text-xl font-heading font-bold tracking-wide text-foreground">
              Lakzee Fitness
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg transition-colors focus-gold ${
                    isActive
                      ? "text-brand-gold font-semibold bg-brand-gold/10"
                      : "text-muted-foreground hover:text-foreground"
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
              className="touch-target px-4 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border transition-colors focus-gold"
            >
              Sign in
            </Link>
            <Link
              href="/member"
              className="touch-target px-5 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] text-sm font-bold active:scale-[0.98] transition-all focus-gold gold-glow-sm"
            >
              Member portal
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="touch-target rounded-lg border border-border text-foreground hover:bg-muted/50 transition-colors focus-gold"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border apple-glass-elevated border-x-0 rounded-none px-4 pt-3 pb-6 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center h-12 px-4 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "text-brand-gold bg-brand-gold/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="pt-4 mt-4 border-t border-border grid grid-cols-2 gap-3">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center h-12 rounded-lg border border-border text-sm font-medium text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/member"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center h-12 rounded-xl bg-[#DBA12C] hover:bg-[#F2C14E] text-[#0A0A0C] text-sm font-bold gold-glow-sm"
            >
              Member portal
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
