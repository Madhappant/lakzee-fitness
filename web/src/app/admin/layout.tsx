"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  CalendarCheck, 
  Settings, 
  LogOut,
  Dumbbell,
  Bell,
  Menu,
  Package,
  BarChart3,
  ShieldCheck,
  UserCircle
} from "lucide-react";

const sidebarGroups = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Members", href: "/admin/members", icon: Users },
      { name: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
      { name: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    title: "Catalog",
    items: [
      { name: "Membership Plans", href: "/admin/plans", icon: Package },
    ],
  },
  {
    title: "Analytics",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Staff & Roles", href: "/admin/staff", icon: ShieldCheck },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    title: "My Account",
    items: [
      { name: "Profile", href: "/admin/profile", icon: UserCircle },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setIsClient(true);
    const token = localStorage.getItem("lakzee_token");
    const userStr = localStorage.getItem("lakzee_user");
    
    if (!token || !userStr) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role === "MEMBER") {
        // Members belong in the member portal
        router.push("/member/dashboard");
      }
    } catch (e) {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("lakzee_token");
    localStorage.removeItem("lakzee_user");
    router.push("/login");
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="h-20 flex items-center px-6 border-b border-border shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-3 group">
            <Image 
              src="/logo.png" 
              alt="Lakzee Fitness Admin Logo" 
              width={40}
              height={40}
              priority
              className="w-10 h-10 object-cover rounded-full bg-white group-hover:scale-105 transition-transform" 
            />
            <span className="text-xl font-bold tracking-tight">LAKZEE</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
          {sidebarGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-4">
                {group.title}
              </p>
              {group.items.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                const Icon = link.icon;
                
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
                      isActive 
                        ? "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border shrink-0">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col min-h-screen md:pl-64 w-full">
        {/* Topbar */}
        <header className="h-20 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 z-40 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile menu"
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
            <h2 className="text-xl font-bold hidden md:block text-foreground/90">Admin Dashboard</h2>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <ThemeToggle />
            <NotificationDropdown role="ADMIN" />
            
            <div className="flex items-center gap-3 border-l border-border pl-4 md:pl-6">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-foreground uppercase tracking-wider">ADMIN</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                <UserCircle className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-gold/5 via-background to-background -z-10" />
          {children}
        </main>
      </div>
    </div>
  );
}
