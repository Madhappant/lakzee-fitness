"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { fetchDashboardStats } from "@/lib/api/dashboard";
import { fetchMembers } from "@/lib/api/members";
import { fetchPlans } from "@/lib/api/plans";
import { fetchSubscriptions } from "@/lib/api/subscriptions";
import { fetchReports } from "@/lib/api/reports";
import { fetchExpenses } from "@/lib/api/expenses";
import { fetchNotificationLogs } from "@/lib/api/notifications";
import { logoutUser } from "@/lib/api/auth";
import { clearPersistedQueryCache } from "@/lib/query-persistence";
import { useBranchScope } from "@/lib/branch-context";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarCheck,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  BarChart3,
  ShieldCheck,
  UserCircle,
  Megaphone,
  Receipt,
  BellRing,
} from "lucide-react";

const sidebarGroups = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "RECEPTIONIST"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Members", href: "/admin/members", icon: Users, roles: ["ADMIN", "RECEPTIONIST", "TRAINER"] },
      { name: "Attendance", href: "/admin/attendance", icon: CalendarCheck, roles: ["ADMIN", "RECEPTIONIST", "TRAINER"] },
      { name: "Payments", href: "/admin/payments", icon: CreditCard, roles: ["ADMIN", "RECEPTIONIST"] },
      { name: "Expenses", href: "/admin/expenses", icon: Receipt, roles: ["ADMIN", "RECEPTIONIST"] },
      { name: "Announcements", href: "/admin/announcements", icon: Megaphone, roles: ["ADMIN"] },
      { name: "Reminders", href: "/admin/reminders", icon: BellRing, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Catalog",
    items: [
      { name: "Membership Plans", href: "/admin/plans", icon: Package, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Analytics",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Staff & Roles", href: "/admin/staff", icon: ShieldCheck, roles: ["ADMIN"] },
      { name: "Settings", href: "/admin/settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
  {
    title: "My Account",
    items: [
      { name: "Profile", href: "/admin/profile", icon: UserCircle, roles: ["ADMIN", "RECEPTIONIST", "TRAINER"] },
    ],
  },
];

const STAFF_ROLES = new Set([
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "ADMIN",
  "RECEPTIONIST",
  "TRAINER",
  "STAFF",
]);

function hasUiRole(userRole: string | null, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;
  if ((userRole === "ADMIN" || userRole === "BRANCH_ADMIN") && !allowedRoles.includes("SUPER_ADMIN_ONLY")) {
    return true;
  }
  if (userRole === "STAFF") {
    return allowedRoles.some((r) => ["RECEPTIONIST", "TRAINER", "STAFF"].includes(r));
  }
  return allowedRoles.includes(userRole);
}

function getDefaultStaffRoute(role: string): string {
  return role === "TRAINER" ? "/admin/members" : "/admin/dashboard";
}

function isRouteAuthorizedForRole(pathname: string, role: string): boolean {
  if (role === "SUPER_ADMIN" || role === "BRANCH_ADMIN" || role === "ADMIN") return true;
  for (const group of sidebarGroups) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return hasUiRole(role, item.roles);
      }
    }
  }
  return true;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("Admin Dashboard");

  useEffect(() => {
    let found = false;
    for (const group of sidebarGroups) {
      const activeItem = group.items.find(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      );
      if (activeItem) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPageTitle(activeItem.name);
        found = true;
        break;
      }
    }
    if (!found) setPageTitle("Admin Dashboard");
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = localStorage.getItem("lakzee_token");
    const userStr = localStorage.getItem("lakzee_user");

    if (!token || !userStr) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role === "MEMBER") {
        router.replace("/member/dashboard");
        return;
      }
      if (!STAFF_ROLES.has(user.role)) {
        router.replace("/login");
        return;
      }
      if (!isRouteAuthorizedForRole(pathname, user.role)) {
        router.replace(getDefaultStaffRoute(user.role));
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsClient(true);
      setUserRole(user.role);
    } catch {
      router.replace("/login");
    }
  }, [router, pathname]);

  const queryClient = useQueryClient();
  const { activeBranchId, refreshBranchScope } = useBranchScope();

  useEffect(() => {
    if (isClient) {
      refreshBranchScope();
    }
  }, [isClient, refreshBranchScope]);

  const handleLogout = async () => {
    clearPersistedQueryCache();
    queryClient.clear();
    await logoutUser();
    router.push("/login");
  };

  useEffect(() => {
    if (!userRole) return;
    const timer = setTimeout(() => {
      router.prefetch("/admin/members");
      router.prefetch("/admin/attendance");
      if (hasUiRole(userRole, ["ADMIN", "RECEPTIONIST"])) {
        router.prefetch("/admin/dashboard");
        router.prefetch("/admin/payments");
        void queryClient.prefetchQuery({
          queryKey: ["dashboardStats", activeBranchId],
          queryFn: fetchDashboardStats,
        });
      }
      void queryClient.prefetchQuery({
        queryKey: ["members", activeBranchId],
        queryFn: () => fetchMembers({ sort: "asc", limit: 100 }),
      });
      void queryClient.prefetchQuery({ queryKey: ["plans", activeBranchId], queryFn: fetchPlans });
    }, 350);
    return () => clearTimeout(timer);
  }, [userRole, activeBranchId, queryClient, router]);

  const handlePrefetch = (href: string) => {
    try {
      if (href === "/admin/dashboard") {
        queryClient.prefetchQuery({
          queryKey: ["dashboardStats", activeBranchId],
          queryFn: fetchDashboardStats,
        });
      } else if (href === "/admin/members") {
        queryClient.prefetchQuery({
          queryKey: ["members", activeBranchId],
          queryFn: () => fetchMembers({ sort: "asc", limit: 100 }),
        });
      } else if (href === "/admin/plans") {
        queryClient.prefetchQuery({ queryKey: ["plans", activeBranchId], queryFn: fetchPlans });
      } else if (href === "/admin/payments") {
        queryClient.prefetchQuery({
          queryKey: ["subscriptions", activeBranchId],
          queryFn: () => fetchSubscriptions(),
        });
      } else if (href === "/admin/reports") {
        queryClient.prefetchQuery({ queryKey: ["reports", activeBranchId], queryFn: fetchReports });
      } else if (href === "/admin/expenses") {
        queryClient.prefetchQuery({
          queryKey: ["expenses", activeBranchId],
          queryFn: () => fetchExpenses(),
        });
      } else if (href === "/admin/reminders") {
        queryClient.prefetchQuery({
          queryKey: ["notificationLogs", activeBranchId],
          queryFn: () => fetchNotificationLogs({ limit: 100 }),
        });
      }
    } catch {
      // Ignore prefetch errors
    }
  };

  if (!isClient || !userRole) return null;

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-200 theme-adaptive">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/75 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Collapsible Minimal Obsidian Sidebar */}
      <aside
        aria-label="Admin Navigation"
        className={`fixed inset-y-0 left-0 z-50 shrink-0 apple-glass-elevated border-r border-border rounded-none flex flex-col transition-all duration-200 ease-out safe-top safe-bottom ${
          isSidebarCollapsed ? "md:w-20" : "md:w-64"
        } w-64 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="h-18 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link
            href={userRole === "TRAINER" ? "/admin/members" : "/admin/dashboard"}
            className={`flex items-center gap-3 group focus-gold rounded-xl p-1 ${
              isSidebarCollapsed ? "md:mx-auto md:justify-center" : ""
            }`}
          >
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-border group-hover:border-primary transition-colors shrink-0">
              <Image
                src="/logo.jpg"
                alt="Lakzee Fitness Studio"
                fill
                sizes="36px"
                preload
                className="object-cover"
              />
            </div>
            <div className={`${isSidebarCollapsed ? "md:hidden" : "block"}`}>
              <span className="font-display text-base font-extrabold tracking-tight text-foreground block leading-none">
                LAKZEE
              </span>
              <span className="font-mono-metric text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                Studio OS
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden touch-target text-muted-foreground hover:text-foreground rounded-lg focus-gold"
            aria-label="Close mobile navigation menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5 custom-scrollbar">
          {sidebarGroups.map((group) => {
            const visibleItems = group.items.filter((item) => hasUiRole(userRole, item.roles));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title} className="space-y-1">
                <p
                  className={`font-mono-metric text-[10px] font-medium text-muted-foreground/70 uppercase tracking-[0.16em] mb-2 px-3 ${
                    isSidebarCollapsed ? "md:hidden" : ""
                  }`}
                >
                  {group.title}
                </p>
                {visibleItems.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      title={isSidebarCollapsed ? link.name : undefined}
                      onMouseEnter={() => handlePrefetch(link.href)}
                      onFocus={() => handlePrefetch(link.href)}
                      onTouchStart={() => handlePrefetch(link.href)}
                      className={`group relative flex items-center gap-3 px-3 min-h-[44px] rounded-xl transition-all duration-200 text-sm focus-gold ${
                        isSidebarCollapsed ? "md:justify-center md:px-0" : ""
                      } ${
                        isActive
                          ? "bg-primary/12 text-foreground font-semibold border border-primary/25"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-transparent"
                      }`}
                    >
                      {/* Golden Yellow Active Indicator Pill */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#DBA12C] ${
                            isSidebarCollapsed ? "md:h-6" : ""
                          }`}
                        />
                      )}
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                          isActive ? "text-[#F2C14E]" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                        aria-hidden="true"
                      />
                      <span className={`tracking-tight truncate ${isSidebarCollapsed ? "md:hidden" : ""}`}>
                        {link.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions: Collapse Toggle + Logout */}
        <div className="p-3 border-t border-border space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className={`hidden md:flex items-center gap-3 px-3 min-h-[44px] w-full rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors duration-200 text-xs focus-gold ${
              isSidebarCollapsed ? "justify-center px-0" : ""
            }`}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">Collapse dock</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Logout" : undefined}
            className={`flex items-center gap-3 px-3 min-h-[44px] w-full rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors duration-200 text-sm focus-gold ${
              isSidebarCollapsed ? "md:justify-center md:px-0" : ""
            }`}
            aria-label="Log out of admin session"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className={`font-medium ${isSidebarCollapsed ? "md:hidden" : ""}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex flex-col min-h-screen w-full transition-all duration-200 ease-out ${
          isSidebarCollapsed ? "md:pl-20" : "md:pl-64"
        }`}
      >
        {/* Minimal Topbar */}
        <header className="h-18 apple-glass border-x-0 border-t-0 rounded-none border-b border-border flex items-center justify-between gap-2 px-3 sm:px-5 md:px-8 z-40 sticky top-0 shrink-0 safe-top">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              className="md:hidden touch-target text-muted-foreground hover:text-foreground rounded-xl focus-gold shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="hidden md:flex items-center gap-2.5 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#DBA12C] shrink-0" aria-hidden="true" />
              <h2 className="font-display text-base font-bold tracking-tight text-foreground truncate">
                {pageTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2.5 md:gap-4 shrink-0">
            <BranchSwitcher userRole={userRole} />
            <ThemeToggle />
            <NotificationDropdown role="ADMIN" />

            <div className="hidden sm:flex items-center gap-2.5 border-l border-border pl-3 md:pl-5">
              <div className="hidden md:block text-right">
                <p className="font-mono-metric text-[11px] font-bold text-foreground uppercase tracking-widest">
                  {userRole}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                <UserCircle className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1440px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
